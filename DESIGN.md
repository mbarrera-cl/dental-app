---
name: Hexa — Shell
description: Warm, modern operating shell for a dental clinic.
colors:
  ground: '#f6f4ef'
  surface: '#fffdf9'
  rail: '#f1eee7'
  ink: '#1c2422'
  ink-soft: '#3d4642'
  muted: '#6e7772'
  line: '#e2ddd2'
  oak: '#a9825f'
  clinic-primary: 'var(--primary)'
  clinic-accent: 'var(--accent)'
typography:
  body:
    fontFamily: 'Onest Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 'normal'
  section-title:
    fontFamily: 'Onest Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '2rem'
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  meta:
    fontFamily: 'Onest Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '11px'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.04em'
rounded:
  control: '8px'
  panel: '14px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.clinic-primary}'
    textColor: 'var(--primary-foreground)'
    rounded: '{rounded.control}'
    padding: '0 14px'
    height: '36px'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '0 14px'
    height: '36px'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    height: '36px'
  nav-item:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.control}'
    padding: '0 10px'
    height: '40px'
  nav-item-active:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '0 10px'
    height: '40px'
  panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.panel}'
---

## Overview

The Hexa shell is the operating frame of a dental clinic: warm, quiet and
precise. It exists so reception, dentists and administrators know where they
are and reach the next task without ceremony. The world is the contemporary
clinic itself — porcelain, pale oak, daylight and the clinic's own colour —
not an artifact (no paper file, map, label sheet or credential as costume).

The signature is the **dayline** under the header: the current date and time,
the active section and its group. It is the first thing the chrome answers,
before any action. The rest of the system stays conventional on purpose:
standard web controls, a sidebar that reads as navigation, tables and forms
that behave the way people already know.

## Colors

- **Ground — `#f6f4ef`:** warm porcelain behind the whole shell.
- **Surface — `#fffdf9`:** cards, inputs, active nav and popovers.
- **Rail — `#f1eee7`:** the sidebar field, one step warmer than the ground.
- **Ink — `#1c2422` / soft `#3d4642`:** text and icons.
- **Muted — `#6e7772`:** metadata, inactive icons and helper copy.
- **Line — `#e2ddd2`:** the only divider weight; borders replace shadows.
- **Oak — `#a9825f`:** reserved for quiet material warmth, never a status.
- **Clinic primary / accent:** dynamic, injected from `GET /clinic/branding`.
  Primary owns the active marker, primary actions and the progress line;
  accent is reserved for assisted surfaces (CaroIA) and never for chrome.
- **Dark mode:** the same roles on `#121816` / `#18201d`, with a 12% white
  line instead of the warm border.

## Typography

- **Onest Variable** is the shell voice: 400 for body, 500 for controls,
  600–650 for section titles and active labels. It is self-hosted through
  `@fontsource-variable/onest`; the shell scopes it to `app-root`.
- **Roboto Variable** remains the approved login voice and the shared family
  for the remotes; the login deliberately keeps its own type.
- **Scale:** body 14px/1.45; nav 13px; meta 11–12px; page titles 32px/1.1;
  hero-like shell titles never exceed 40px. Data uses tabular numerals.
- **Labels** are sentence case. Uppercase is reserved for the dayline group
  and small state metadata with `0.08em` tracking.
- **Measure:** body copy stays under 80 characters; tables and forms use the
  full content width.

## Layout

- **Header — 64px:** clinic lockup left; dayline centre; actions right
  (CaroIA, activity, language, user). On mobile the hamburger returns, the
  dayline hides and the language moves into the user menu.
- **Sidebar — 248px:** database-driven tree; 40px rows; 36px children; a
  3px primary marker and a white surface for the active item. Collapses to a
  72px icon rail; state persists in `localStorage`. On mobile it is a drawer
  with a backdrop, scroll lock, focus trap and Escape close.
- **Content:** max 1180px, 30/28px padding desktop, 20/16px mobile. Remotes
  own their internal layout; the shell only frames them. A `surface` wrapper
  gives narrow screens horizontal containment.
- **No footer.** The old brand/tech footer was noise in daily operation.
- **Login:** full-bleed, unchanged; it keeps its own chrome and type.

## Elevation & Depth

Borders and one-step surface changes carry hierarchy. Shadows appear only on
overlays (user menu, activity panel, dialogs) and on the active nav item's
1px lift. The drawer uses a translucent ink backdrop with a 2px blur.

## Shapes

Two radii only: **8px** for controls (buttons, inputs, nav rows) and **14px**
for panels and banners. Avatars and logo tiles are 6–8px, never pills unless
the element is a status badge. Dividers are 1px; group rails are 1px.

## Components

- **Header actions:** standard `hlmBtn` controls; CaroIA gets a primary-tinted
  outline and is the only assistant-coloured action.
- **Nav item:** icon + label, 40px, rounded 8px; hover warms the surface;
  active becomes a white card with a primary 3px marker and `aria-current`.
- **Group:** same row grammar, chevron rotates 90°; children indent behind a
  1px rule.
- **Dayline:** date/time in tabular figures, a 1px rule, section in 600 weight,
  group in 10px uppercase muted. Hidden below 900px.
- **Onboarding banner:** primary-tinted panel with one CTA and a dismiss.
- **Route error:** destructive-tinted panel, one retry; retry reloads the
  target because Native Federation cannot re-initialize a failed remote.
- **Progress:** 2px primary sweep under the header while a route resolves.
- **Inputs and buttons:** standard spartan/ui primitives, 36px height.

## Do's and Don'ts

- **Do** let the clinic's primary colour carry orientation; never hardcode a
  product accent for active state.
- **Do** keep the dayline and the active nav item in agreement.
- **Do** use borders and surface steps before shadows.
- **Do** preserve the login's Roboto voice and full-bleed editorial layout.
- **Don't** introduce a third radius, a decorative texture, or a paper/map
  metaphor over the working screen.
- **Don't** hide navigation behind icon-only controls on desktop; the rail is
  an opt-in collapse.
- **Don't** put CaroIA, activity, language and help at the same visual weight.
- **Don't** remove the focus ring or the reduced-motion fallback.
