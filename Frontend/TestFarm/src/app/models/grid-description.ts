import { HostDescription } from "./host-description"

export interface GridDescription {
    Id: number,
    Name: string,
    CreationTimestamp: string,
    LastUpdateTimestamp: string,
    Hosts: HostDescription[]
}