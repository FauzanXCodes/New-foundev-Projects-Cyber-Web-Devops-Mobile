# Portfolio Case Study

## Problem

Cloud costs are hard to reason about early on. Even a modest workload spans
compute, storage, a database, and data transfer, each with its own pricing unit,
and it is easy to blow a budget without noticing which service is driving spend.

## Solution

An interactive workbench that breaks a workload into clear, editable parts and
answers the questions a cloud engineer actually asks:

- What am I estimating, and which services contribute to the cost?
- How is the cost distributed across services?
- Am I within budget, and by how much (monthly and annually)?
- What could I change to reduce the largest driver?
- How does this scenario compare with another I saved?

## Technical approach

Plain HTML, CSS, and ES modules with no framework and no build step. The
calculation layer is a set of pure functions built around a service registry, so
it is tested independently of the UI. A single module orchestrates the DOM; every
other module is pure or storage-injectable. All external input (saved state,
imported files, shared URLs) is normalized so the app cannot be put into an
invalid state.

## What I practised

- structuring a small frontend around a pure, testable core
- modelling several AWS services with honest, editable sample pricing
- budget-health classification and deterministic recommendations
- versioned local storage, export/import, and shareable URL state
- an accessible, responsive, dual-theme interface
- a broad automated test suite and multi-version CI

## Honest scope

The pricing is simplified sample data, clearly labelled throughout, not a live or
official AWS quote. The goal is to demonstrate engineering and FinOps thinking,
not to reproduce an AWS invoice.
