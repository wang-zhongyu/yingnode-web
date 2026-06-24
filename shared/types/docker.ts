export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  state: "running" | "exited" | "paused" | "restarting"
  ports: string
  created: string
}

export type ContainerAction = "start" | "stop" | "restart"
