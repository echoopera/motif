# Bundled design principles
An original studio practice guide. These principles are useful offline, but are not an exhaustive platform manual, accessibility standard or API compatibility database.

## Start with the task
Name the person, context, goal, objects they manipulate and consequence of failure. Every major screen supports a meaningful task or decision. Keep the user's work visible; preserve progress across navigation and interruption. Prioritize clear recovery over explanations that leave the user stuck. Learn the client's vocabulary before replacing it.

## iPhone
Design for compact width and variable height, including safe areas and the software keyboard. Keep common actions easy to reach without concealing essential alternatives in gestures. Preserve navigation history and offer explicit dismissal. Reflow long content and enlarged text. Avoid hover-dependent features. Show meaningful progress during capture, import, and saving; explain denied permission with a useful next action.

Use semantic/native controls where they can express the task. Custom musical or artistic controls need explicit units, accessible names, value adjustment alternatives and recoverable gestures. Do not infer precise OS behavior or API availability from these principles.

## iPad
Treat available window width, input method and device size separately. Adapt a multipane workspace into a coherent narrow-window flow; retain selection and work when panes collapse. Combine touch with keyboard/pointer affordances. Pencil interactions enhance relevant creative tasks without making common tasks inaccessible to other input. Define which window owns the document and what happens when two windows edit it. Keep inspectors and transient overlays from hiding the active work.

## Rich web
Use semantic controls for actions, forms and navigation. Canvas/GPU rendering does not replace an accessible task model. Provide object lists, inspectors or equivalent controls for essential canvas actions. Define pointer cancellation, focus return, keyboard interaction, history, loading and failed requests. Cancel obsolete work and prevent stale responses from replacing newer results. Release listeners, timers and render resources during teardown. Reduced motion must preserve status and orientation. Test touch with no hover.

## SaaS and internal tools
Differentiate account, workspace, role and object scope. Keep filters, selection counts and bulk-action consequences clear. Provide preview or recovery appropriate to impact. Distinguish drafts from committed changes and partial success from complete success. Explain permission limits without falsely implying the client UI enforces them. Make dense information navigable through grouping, hierarchy and adjustable detail.

## Editorial and creative software
Separate source content, rendered preview and published revision. Identify locale, region, rights window, timezone and approval state when they affect decisions. Show dependency impact before changing reusable content. Model creative documents independently of viewport, selection and render cache. Define undo grouping, autosave, interrupted export, asset ownership and color/export intent. Music interfaces expose units/ranges and distinguish engine state from display refresh; DSP behavior requires separate engineering evidence.

## Accessibility and behavior
Use meaningful headings, persistent field labels, visible focus, clear error association and program alternatives to gesture-only interaction. Communicate state through more than color. Check contrast, text resizing, reflow and content clipping. Support keyboard order and escape routes appropriate to the interaction. Return focus meaningfully after dismissing transient UI. Avoid announcing every frame of rapid visual updates. Test screen-reader behavior instead of assuming labels alone prove usability.

WCAG 2.2 AA remains the default web target where appropriate. These notes are not the complete success criteria and cannot establish conformance. If normative material or an appropriate assessment environment is unavailable, explicitly leave conformance unverified.

## Visual systems and craft
Define primitive, semantic and component tokens with consistent typography, spacing, color purpose and state behavior. Optical alignment and actual content fit matter alongside mathematical grids. Differentiate selected, focused, disabled, busy and error states. Use product-specific art direction; do not combine unrelated system styles by default. Make motion explain cause, change or feedback. Check light/dark appearances and long/localized text.

## Evidence and portability
Name the tested artifact revision, environment, scenario and observed outcome. Keep inference separate from observation. A rendered image does not prove interaction and a desktop test does not establish device parity. Inspect local dependency licenses before reuse. All agent definitions and shared practice needed to operate this harness are included; product-specific facts still require supplied evidence or explicit uncertainty.
