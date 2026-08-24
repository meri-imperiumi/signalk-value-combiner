# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Combined output paths now carry Signal K `units` metadata inferred
  from the inputs: when all inputs that have a unit agree, the output
  inherits it; when only one input carries a unit, that unit is used.
  The meta is published as a separate meta delta and only re-sent when
  the inferred unit changes.

### Future
- For compound units the heuristic is insufficient (e.g. `V * A = W`).
  Allow the unit to be specified directly on the combine rule so users
  can override/declare the output unit for cases like multiplication of
  different quantities.

## [1.1.2] - 2026-06-16
### Changed
- Moved calculation logic to its own file and added basic unit tests

## [1.1.1] - 2026-06-16
### Added
- Added app icon

## [1.1.0] - 2026-01-19
### Added
- Added support for multiplication

## [1.0.0] - 2025-08-05
### Changed
- Initial release, addition support
