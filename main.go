package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
	metricsv1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
	metrics "k8s.io/metrics/pkg/client/clientset/versioned"

	api "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

var port = ":8282"

// Metric ...
type Metric struct {
	Name        string `json:"name"`
	Cpu         string `json:"cpu"`
	CpuTotal    string `json:"cpu_total"`
	Memory      string `json:"memory"`
	MemoryTotal string `json:"memory_total"`
}

// PodMetric is a Pod with metrics
type PodMetric struct {
	Spec       api.PodSpec       `json:"spec"`
	ObjectMeta metav1.ObjectMeta `json:"metadata"`
	Status     api.PodStatus     `json:"status"`
	Metrics    Metric            `json:"metrics"`
}

// ParsedMetric ...
type ParsedMetric struct {
	Items []Metric `json:"items"`
}

// ParsedPodMetric ...
type ParsedPodMetric struct {
	Items []PodMetric `json:"items"`
}

func main() {
	var kubeconfig *string
	if home := os.Getenv("HOME"); home != "" {
		kubeconfig = flag.String("kubeconfig", filepath.Join(home, ".kube", "config"), "(optional) absolute path to the kubeconfig file")
	} else {
		kubeconfig = flag.String("kubeconfig", "", "absolute path to the kubeconfig file")
	}
	flag.Parse()
	config, err := clientcmd.BuildConfigFromFlags("", *kubeconfig)
	if err != nil {
		panic(err.Error())
	}

	// create the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}
	metricset, err := metrics.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	http.HandleFunc("/nodes", func(w http.ResponseWriter, r *http.Request) {
		cors(&w)
		items, err := nodes(clientset)
		str, err := json.MarshalIndent(items, "", "    ")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(str)
	})

	http.HandleFunc("/pods", func(w http.ResponseWriter, r *http.Request) {
		cors(&w)
		items, err := pods(clientset)
		str, err := json.MarshalIndent(items, "", "    ")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(str)
	})
	http.HandleFunc("/services", func(w http.ResponseWriter, r *http.Request) {
		items, err := services(clientset)
		str, err := json.MarshalIndent(items, "", "    ")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(str)
	})

	http.HandleFunc("/metrics/nodes", func(w http.ResponseWriter, r *http.Request) {
		cors(&w)
		items, err := nodeMetrics(metricset, clientset)
		str, err := json.MarshalIndent(items, "", "    ")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(str)
	})
	http.HandleFunc("/metrics/pods", func(w http.ResponseWriter, r *http.Request) {
		cors(&w)
		items, err := podMetrics(metricset)
		str, err := json.MarshalIndent(items, "", "    ")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(str)
	})

	fmt.Printf("starting on: %s", port)
	http.ListenAndServe(port, nil)
}

func nodes(clientset *kubernetes.Clientset) (api.NodeList, error) {
	items, err := clientset.CoreV1().Nodes().List(metav1.ListOptions{})
	return *items, err
}

func pods(clientset *kubernetes.Clientset) (ParsedPodMetric, error) {
	items, err := clientset.CoreV1().Pods(metav1.NamespaceAll).List(metav1.ListOptions{})
	var parsed []PodMetric
	for _, pod := range items.Items {
		p := PodMetric{
			Spec:       pod.Spec,
			ObjectMeta: pod.ObjectMeta,
			Status:     pod.Status,
		}
		c := pod.Spec.Containers[0]
		if c.Resources.Requests != nil {
			m, _ := c.Resources.Limits.Memory().CanonicalizeBytes(make([]byte, 0, 18))
			memory := string(m)
			metric := Metric{
				CpuTotal:    fmt.Sprintf("%d", c.Resources.Limits.Cpu().MilliValue()),
				MemoryTotal: memory,
			}
			p.Metrics = metric
		}
		parsed = append(parsed, p)
	}
	return ParsedPodMetric{Items: parsed}, err
}

func services(clientset *kubernetes.Clientset) (api.ServiceList, error) {
	items, err := clientset.CoreV1().Services(metav1.NamespaceAll).List(metav1.ListOptions{})
	return *items, err
}

func cors(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
}

func nodeMetrics(metricset *metrics.Clientset, clientset *kubernetes.Clientset) (ParsedMetric, error) {
	items, err := metricset.MetricsV1beta1().NodeMetricses().List(metav1.ListOptions{})
	var parsed = []Metric{}
	for _, nodeUsage := range items.Items {
		c := nodeUsage.Usage.Cpu().MilliValue()
		cpu := fmt.Sprintf("%d", c)

		m, _ := nodeUsage.Usage.Memory().CanonicalizeBytes(make([]byte, 0, 18))
		memory := string(m)

		node, _ := clientset.CoreV1().Nodes().Get(nodeUsage.ObjectMeta.Name, metav1.GetOptions{})
		m2, _ := node.Status.Allocatable.Memory().CanonicalizeBytes(make([]byte, 0, 18))
		memoryTotal := string(m2)
		cpuTotal := fmt.Sprintf("%d", node.Status.Allocatable.Cpu().MilliValue())

		parsed = append(parsed, Metric{
			Name:        node.ObjectMeta.Name,
			CpuTotal:    cpuTotal,
			Cpu:         cpu,
			Memory:      memory,
			MemoryTotal: memoryTotal,
		})
	}

	return ParsedMetric{Items: parsed}, err
}

func podMetrics(metricset *metrics.Clientset) (metricsv1.PodMetricsList, error) {
	items, err := metricset.MetricsV1beta1().PodMetricses(metav1.NamespaceAll).List(metav1.ListOptions{})
	return *items, err
}
