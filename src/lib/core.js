// Core logic for the TsuMNN Area Maker — a barrel that re-exports the
// modules underneath, so callers keep importing everything from here
// while the logic itself lives in focused files:
//
//   util.js    — tiny shared helpers (strip, uid)
//   fields.js  — format definitions: fields, defaults, descriptions, templates
//   model.js   — areas and projects: create, check, reorder, delete, merge
//   links.js   — link maths: effective targets, edges, directions, focus sets
//   yaml.js    — reading and writing areas.yaml
//   arrange.js — auto-arrange layout
//
// Everything is framework-free and takes the project object (P)
// explicitly, so all of it can be unit-tested in Node.
export * from './util.js';
export * from './fields.js';
export * from './model.js';
export * from './links.js';
export * from './yaml.js';
export * from './arrange.js';
