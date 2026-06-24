import { ContainerList } from "@/features/docker/components/container-list"

export default function DockerPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Docker 容器</h1>
      <ContainerList />
    </div>
  )
}
