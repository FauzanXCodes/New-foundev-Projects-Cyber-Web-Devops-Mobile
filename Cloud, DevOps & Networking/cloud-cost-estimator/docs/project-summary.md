# Project Summary

Cloud Cost Calculator is a lightweight, dependency-free AWS FinOps planning
workbench. It models a multi-service workload (EC2, EBS, S3, RDS, and outbound
data transfer) across four sample regions, tracks budget health, compares saved
scenarios, and exports or shares the result, all as a static frontend.

The project demonstrates:

- cloud cost awareness across compute, storage, database, and transfer
- a pure, testable estimation engine separated from the DOM
- budget-health classification and deterministic, driver-based recommendations
- versioned local-storage persistence, JSON/CSV export, import, and share links
- an accessible, responsive, token-based interface with light and dark themes
- defensive handling of invalid input, corrupt storage, and malformed URLs
- a broad Node test suite and CI across multiple Node versions

## Purpose

This is a learning and portfolio project, not a replacement for the official AWS
Pricing Calculator. It shows how cloud cost components can be modelled clearly in
a small, well-structured frontend, with honest, editable sample pricing.

## Portfolio value

Useful for demonstrating practical understanding of AWS cost basics, FinOps
thinking, JavaScript architecture, UI state management, accessibility, testing,
and documentation.
