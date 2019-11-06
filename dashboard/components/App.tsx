import React, { PureComponent } from 'react'
import axios from 'axios'
import './app.sass'
import NodeComponent, { Node, Pod } from './Node'
import Toggle from 'react-toggle'
import 'react-toggle/style.css'

interface Config {
  url: string
  token: string
}
interface State {
  nodes?: Node[]
  pods?: Node[]
  loading: boolean
  opts?: {
    showName: boolean
    showMetrics: boolean,
    hideSystemPod: boolean
  }
}
interface EntityRequest {
  image: string
  command: string
  jobId: string
  token?: string
}

const config: Config = {
  url: 'http://localhost:8282',
  token: 'token'
}

export default class App extends PureComponent {
  state: State = {
    nodes: [],
    pods: [],
    loading: true,
    opts: {
      showName: false,
      showMetrics: false,
      hideSystemPod: true
    }
  }
  request = (param: string) =>
    axios.get(config.url + '/' + param).then(({ data }) => data.items)

  componentDidMount = () => {
    this.request('nodes').then((nodes: Node[]) => {
      this.request('metrics/nodes').then((nmet) => {
        this.request('pods').then((pods: Pod[]) => {
          this.request('metrics/pods').then((pmet) => {
            const mPods = pods.map((pod: Pod) => {
              pod.metrics = pmet.find((v: Pod) => v.metadata.name === pod.metadata.name)
              return pod
            })
            const mNodes = nodes.map((node) => {
              node.pods = mPods.filter((pod: Pod) => pod.spec.nodeName === node.metadata.name)
              node.metrics = nmet.find((v) => v.name === node.metadata.name)
              return node
            })
            this.setState({ nodes: mNodes, loading: false })
          })
        })
      })
    })
  }
  renderEntity = (entity: Node) => {
    return <NodeComponent
      key={entity.metadata.name}
      opts={this.state.opts}
      entity={entity}
    />
  }
  setText = ({ target }) => {
    this.setState({ [target.name]: target.value })
  }
  toggleNames = (param) => {
    this.setState((s) => ({ ...s, opts: { ...s.opts, [param]: !s.opts[param] } }))
  }
  renderLoader = () => {
    return <div className="loader">
      loading...
    </div>
  }
  renderHeader = () => {
    const toggleName = () => this.toggleNames('showName')
    const toggleMetrics = () => this.toggleNames('showMetrics')
    const toggleSystemPod = () => this.toggleNames('hideSystemPod')
    return <div className="header">
      <label>
        <Toggle
          onChange={toggleName}
          defaultChecked={this.state.opts.showName} />
        <span>Show/Hide Pod names</span>
      </label>
      <label>
        <Toggle
          onChange={toggleMetrics}
          defaultChecked={this.state.opts.showMetrics} />
        <span>Show/Hide Pod metrics</span>
      </label>
      <label>
        <Toggle
          onChange={toggleSystemPod}
          defaultChecked={this.state.opts.hideSystemPod} />
        <span>Hide Systems Pod</span>
      </label>
    </div>
  }
  render = () => {
    return <div className="dashboard">
      {!this.state.loading && this.renderHeader()}
      {this.state.loading && this.renderLoader()}
      <div className="nodes">
        {this.state.nodes.map(this.renderEntity)}
      </div>
    </div>
  }
}
