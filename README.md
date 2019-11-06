# kuberhaus
> Resource dashboard for kubernetes

<p align="center">
  <img height="200" src="assets/logo.png">
</p>

<p align="center">
  <img height="200" src="assets/screenshot1.png">
</p>


### Setup

Connect to your desired kubernetes cluster:

```
kubectl config use-context <cluster-name>
```

```
go run main.go
```

Now start the dashboard:

```
cd dashboard

yarn

yarn start
```

# Using Docker
Use existing image `stevelacy/kuberhaus`
Build image

```sh
docker build -t kuberhaus:latest .
```

Run container and mount config to container
```sh
docker run -v ~/.kube/:/root/.kube -p 8282:8282 --name kuberhaus kuberhaus
```

MIT
