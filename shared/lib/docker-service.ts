import { execAsync, safeArg } from "@/shared/lib/shell"
import type { DockerContainer, ContainerAction } from "@/shared/types/docker"

class DockerService {
  private dockerAvailable: boolean | null = null

  /** Check if Docker is installed and accessible. Result is cached. */
  async isAvailable(): Promise<boolean> {
    return this.checkDocker()
  }

  /** Check if Docker is installed and accessible. Result is cached. */
  private async checkDocker(): Promise<boolean> {
    if (this.dockerAvailable !== null) return this.dockerAvailable
    try {
      await execAsync("sudo docker info", 5000)
      this.dockerAvailable = true
    } catch {
      this.dockerAvailable = false
    }
    return this.dockerAvailable
  }

  async getContainers(all = true): Promise<DockerContainer[]> {
    const available = await this.checkDocker()
    if (!available) return []

    const args = all ? "-a" : ""
    const { stdout } = await execAsync(
      `sudo docker ps ${args} --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}|{{.CreatedAt}}"`,
    )

    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [id, name, image, status, state, ports, created] = line.split("|")
        return {
          id,
          name,
          image,
          status,
          state: state as DockerContainer["state"],
          ports,
          created,
        }
      })
  }

  async containerAction(id: string, action: ContainerAction): Promise<void> {
    const available = await this.checkDocker()
    if (!available) throw new Error("Docker 不可用")
    await execAsync(`sudo docker ${action} ${safeArg(id)}`)
  }

  async getLogs(id: string, tail = 100): Promise<string> {
    const available = await this.checkDocker()
    if (!available) return ""
    const { stdout } = await execAsync(`sudo docker logs --tail ${tail} ${safeArg(id)}`)
    return stdout
  }
}

export const dockerService = new DockerService()
