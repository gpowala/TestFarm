import { HostDescription } from "./host-description"

export interface GridDescription {
    _id: string,
    name: string,
    creationTime: string,
    lastUpdateTime: string,
    hosts: HostDescription[]
}