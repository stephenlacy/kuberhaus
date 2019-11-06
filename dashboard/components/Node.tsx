import React, { PureComponent, useCallback } from 'react'
import { IoIosRemoveCircle, IoIosPlay } from 'react-icons/io'
import randomColor from 'randomcolor'
import './node.sass'

interface Resource {
  cpu: string
  memory: string
}

interface Container {
  resources: {
    requests: Resource
    limits: Resource
  }
}

export interface Entity {
  metadata?: {
    name: string
    namespace: string
    ownerReferences: []
  }
  status?: {
    capacity: {
      cpu: string
      memory: string
    }
    allocatable: {
      cpu: string
      memory: string
    }
  }
  spec?: {
    nodeName: string
    containers: Container[]
  }
  metrics?: {
    cpu: string
    cpu_total: string
    memory: string
    memory_total: string
  }
}


export interface Node extends Entity {
  id?: string
  pods?: Pod[]
}

export interface Pod extends Entity {
}

type NodeProps = {
  entity: Node
  opts?: {
    showName: boolean
    showMetrics: boolean,
    hideSystemPod: boolean
  }
}

export const renderNode = (entity: Node) => {
  return <NodeComponent
    key={entity.metadata.name}
    entity={entity}
  />
}

export const renderPod = (entity: Pod, opts: NodeProps["opts"]) => {
  return <PodComponent
    key={entity.metadata.name}
    entity={entity}
    opts={opts}
  />
}

const colors = {}

const getColor = (entity: Entity) => {
  if (entity.metadata.namespace.includes('system')) return 'lightgrey'
  const short = entity.metadata.ownerReferences && entity.metadata.ownerReferences[0].name || entity.metadata.uid
  if (colors[short]) return colors[short]
  const c = randomColor({
    hue: 'blue',
  })
  colors[short] = c
  return c
}

const renderValueDiff = (a: string, b: string) => {
  const a1 = a.replace(/[^\d.-]/g, '')
  const b1 = b.replace(/[^\d.-]/g, '')
  return parseFloat(parseInt(b1) / parseInt(a1)).toFixed(2) * 100
}

const renderKitoGb = (a: string) => {
  const a1: number = parseInt(a)
  return parseFloat(a1 / 976562).toFixed(2) + 'GB'
}

const EntityComponent = ({ children, bg, ...rest }) =>
  <div
    className="entity"
    style={{ backgroundColor: bg }}
    {...rest}>
    {children}
  </div>

const renderResources = (container: Container) => {
  if (!container) return null
  if (!container.resources) return null
  if (!container.resources.requests) return null
  if (!container.resources.limits) return null
  return <div className="row">
    <div className="row">
      CPU request: {container.resources.requests.cpu}
    </div>
    <div className="row">
      Memory request: {container.resources.requests.memory}
    </div>
    <div className="row">
      CPU limit: {container.resources.limits.cpu}
    </div>
    <div className="row">
      Memory limit: {container.resources.limits.memory}
    </div>
  </div>
}

const PodComponent = ({ entity, opts }: NodeProps) => {
  console.log(entity)
  const hideSystemPod = opts.hideSystemPod;
  const bg = getColor(entity)
  if (entity.metadata.namespace.includes('system') && hideSystemPod){
    return null;
  }
  return <EntityComponent
    title={entity.metadata.name}
    bg={bg}>
    <div className="row">
      {opts.showName && entity.metadata.name.substring(0, 24)}
    </div>
    {opts.showMetrics && renderResources(entity.spec.containers[0])}
  </EntityComponent>
}

const NodeComponent = ({ entity, opts }: NodeProps) => {
  return <EntityComponent>
    <div className="row">
      {entity.metadata.name}
    </div>
    <div className="row">
      <div className="value">Total CPU: {entity.status.allocatable.cpu}</div>
      <div className="value">Current CPU: {entity.metrics.cpu}</div>
    </div>
    <div className="row">
      CPU Usage: {renderValueDiff(entity.metrics.cpu_total, entity.metrics.cpu) + '%'}
    </div>
    <div className="row">
      <div className="value">Total Memory: {renderKitoGb(entity.metrics.memory_total)}</div>
      <div className="value">Current Memory: {renderKitoGb(entity.metrics.memory)}</div>
    </div>
    <div className="row">
      Memory Usage: {renderValueDiff(entity.metrics.memory_total, entity.metrics.memory) + '%'}
    </div>
    <div className="row">
      {entity.pods.map((v) => renderPod(v, opts))}
    </div>
  </EntityComponent>
}
export default NodeComponent
