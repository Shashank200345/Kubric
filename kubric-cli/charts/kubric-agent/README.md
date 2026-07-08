# kubric-agent (Placeholder Chart)

This is a placeholder chart. It does not run real diagnostics or collect real cluster data. It exists to let `kubric connect` be tested end-to-end before the real in-cluster agent is built.

Replace `templates/deployment.yaml`'s image and command when the real agent is ready — the `values.yaml` contract (`clusterToken`, `ingestionEndpoint`, `clusterName`, `image`) should stay the same so the CLI never needs to change.

## Values

| Key                | Default                                  | Description                        |
| ------------------ | ---------------------------------------- | ---------------------------------- |
| `image.repository` | `busybox`                                | Container image repository         |
| `image.tag`        | `1.36`                                   | Container image tag                |
| `ingestionEndpoint`| `https://api.kubric.dev/v1/ingest`       | Backend ingestion endpoint         |
| `clusterToken`     | `""`                                     | Per-cluster auth token from backend|
| `clusterName`      | `""`                                     | Name of the connected cluster      |
| `resources`        | `requests: 10m/16Mi, limits: 50m/32Mi`   | Pod resource requests and limits   |
