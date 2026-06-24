import { exec } from "child_process"
import { promisify } from "util"
import type { DockerContainer, ContainerAction } from "@/shared/types/docker"

const execAsync = promisify(exec)

class DockerService {
  async getContainers(all = true): Promise<DockerContainer[]> {
    const args = all ? "-a" : ""
    const { stdout } = await execAsync(
      `docker ps ${args} --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}|{{.CreatedAt}}"`,
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
    await execAsync(`docker ${action} ${id}`)
  }

  async getLogs(id: string, tail = 100): Promise<string> {
    const { stdout } = await execAsync(`docker logs --tail ${tail} ${id}`)
    return stdout
  }
}

export const dockerService = new DockerService()
