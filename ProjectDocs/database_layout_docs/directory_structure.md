
```
users
  └─ {userId} (doc) // User profile
        └─ graphs (subcollection)
            └─ {graphId} (doc) // Graph profile
                ├─ nodes (subcollection)
                    ├─ {nodeId_1} (doc)
                    ├─ {nodeId_2} (doc)
                    └─ {nodeId_N} (doc)
                └─ edges (subcollection)
                    ├─ {edgeId_1} (doc)
                    ├─ {edgeId_2} (doc)
                    └─ {edgeId_K} (doc)

templates
    └─ {template_source_name} (subcollection) // Template source, e.g. Texas TEKS
        └─ {subject} (subcollection) // e.g. Math
                └─ {graphId} (doc) // Graph profile
                    ├─ nodes (subcollection)
                        ├─ {nodeId_1} (doc)
                        ├─ {nodeId_2} (doc)
                        └─ {nodeId_N} (doc)
                    └─ edges (subcollection)
                        ├─ {edgeId_1} (doc)
                        ├─ {edgeId_2} (doc)
                        └─ {edgeId_K} (doc)
```
