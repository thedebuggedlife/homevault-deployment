export interface Publisher {
    URL: string;
    TargetPort: number;
    PublishedPort: number;
    Protocol: string;
}

export interface DockerContainer {
    Command: string;
    CreatedAt: string;
    ExitCode: number;
    Health: string;
    ID: string;
    Image: string;
    Labels: string;
    LocalVolumes: string;
    Mounts: string;
    Name: string;
    Names: string;
    Networks: string;
    Ports: string;
    Project: string;
    Publishers: Publisher[];
    RunningFor: string;
    Service: string;
    Size: string;
    State: string;
    Status: string;
}