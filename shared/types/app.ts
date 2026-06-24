export interface AppDefinition {
  id: string
  name: string
  description: string
  category: string
  icon: string
  install: string
  uninstall?: string
  check?: string
}

export interface AppWithStatus extends AppDefinition {
  installed: boolean
  installing: boolean
}
