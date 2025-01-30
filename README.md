# Tailormap tools

Repository with (dev) scripts/tools to use for Tailormap development

To use the tools it is required to add a `tm-project.json` file to the root of the project. In this `tm-project.json` file
you need to specify the projects in that specific project.

The structure for a `tm-project.json` file looks like:

```json
{
    "coreProjectLocation": "LOCATION_FOR_TAILORMAP_CORE",
    "projects": [
        ["PROJECT_SCOPE", "PROJECT_NAME"]
    ]
}
```

For tailormap-viewer this looks like:

```json
{
    "coreProjectLocation": "projects/core",
    "libraries": [
        ["@tailormap-viewer", "api"],
        ["@tailormap-viewer", "shared"],
        ["@tailormap-viewer", "map"],
        ["@tailormap-admin", "admin-api"],
        ["@tailormap-admin", "admin-core"],
        ["@tailormap-viewer", "core"]
    ]
}
```

and for an extension repo this looks like:

```json
{
    "coreProjectLocation": "node_modules/@tailormap-viewer/core",
    "libraries": [
        ["@tailormap-b3p", "hello-world"]
    ]
}
```

