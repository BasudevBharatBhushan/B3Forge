---
name: discovery
description: Discovery before writing a plan. Graph-first querying (Graphify), get_neighbors, shortest_path, the graph locates but does not testify, refresh once per ticket. Load before writing any plan.
---

# /discovery

Discovery completes **before** the plan is written.

1. **Read the behavior book.** For each affected area, read `ai-workspace/behavior/<area>.md`
   before planning; it is the current contract. Code that disagrees with it is a finding to
   record in Discovery, not an assumption to resolve. No file yet → note that, and the
   ticket's B7 will create it.
2. **Query the graph before any exploration.** The project keeps a Graphify knowledge graph;
   query it instead of scanning directories, and use returned paths to target reads. Call
   reference: `.agents/rules/graphify.md`. No graph yet → building it is a setup task, not a
   licence to skip discovery.
3. `get_neighbors` on anything about to be edited, for callers and dependents — prevents
   unintended breakage.
4. `shortest_path` from entry point to leaves for cross-cutting changes.
5. **The graph locates; it does not testify.** Never describe what code does, or write a plan
   step against it, from graph metadata, a filename, or a symbol name alone — open the file
   first. A path and an edge point at evidence; they are not the evidence.
6. Record only plan-relevant findings in the ticket's Discovery section.
7. Refresh the graph **once per ticket** (at verification, see `/close-ticket`).

Discovery is read-only and stays in the orchestrator — never dispatched.
