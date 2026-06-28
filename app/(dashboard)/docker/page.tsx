import type { DockerContainer } from "@/shared/types/docker"
import { dockerService } from "@/shared/lib/docker-service"
import { ContainerList } from "@/features/docker/components/container-list"

export default async function DockerPage() {
  let initialContainers: DockerContainer[] = []
  let dockerAvailable = true
  try {
    initialContainers = await dockerService.getContainers()
    dockerAvailable = await dockerService.isAvailable()
  } catch {
    initialContainers = []
    dockerAvailable = false
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Docker 容器</h1>
      <ContainerList initialContainers={initialContainers} initialDockerAvailable={dockerAvailable} />
    </div>
  )
}
