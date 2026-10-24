# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Reception and clinic administration:** work the front desk all day, often standing or on a laptop, switching between patients, agenda, quotes and cash. They need speed and certainty about where they are.
- **Dentists:** open a patient record, agenda or treatment plan between appointments; they tolerate density but not ambiguity.
- **Clinic administrators / owners:** manage users, roles, menus, API keys and clinic identity; they need control without breaking the clinical flow.

Spanish is the default language; English is available. Sessions are long and multi-tasking is the norm.

## Product Purpose

Hexa runs the operational day of a dental clinic: patients and clinical records, agenda, quotes, cash, indicators and administration. The shell is the single entry point across independently deployed microfrontends. Success means reaching the right task in seconds and always knowing which section and context you are in.

## Positioning

One shell over independently deployed clinical microfrontends, with navigation, permissions and clinic branding driven by the database. A neighboring product could copy a feature, but not the combination of per-clinic identity and a menu/RBAC tree that each clinic configures without a redeploy.

## Operating Context

- Reception desks and clinical workstations under artificial light, with sessions that last most of the day.
- Frequent switching between a patient, the agenda, a quote and a payment; returning to a task must not cost orientation.
- Clinic identity (name, logo, primary/accent colour, favicon) is configured in the database and applies live to shell, login and print headers.
- The navigation tree (groups, items, dividers, icons, permissions) is also stored in the database and filtered by the signed-in principal.
- Roles and permissions are enforced in the API and reflected in the shell; hidden sections must never appear as dead links.
- Light and dark modes are both first-class. es/en dictionaries must stay in parity.

## Capabilities and Constraints

- Angular 22 microfrontends with Native Federation; the shell composes `patients`, `users`, `dashboard`, `admin`, `quotes` and `agenda` from separate dev servers/ports.
- Shared design tokens live in the `ui` library and are consumed by shell and remotes; changing them affects every app.
- The login screen owns its own full-bleed chrome and is out of scope for this redesign.
- Branding is dynamic: the shell must work with any clinic primary/accent colour, including light primaries and dark mode.
- The shell owns: header, navigation sidebar, footer, breadcrumbs/context, the clinic settings page, the menu editor, activity, API keys, forbidden and the CaroIA frame.
- Remote pages own their internal layout, tables, forms and empty states; the shell must not restyle them.
- CaroIA is an assistant surface and must remain visually distinct without becoming the loudest element on every screen.

## Brand Commitments

- The clinic owns the brand. The shell may not impose a fixed product palette or logo over the configured one.
- Roboto Variable is the bundled workhorse family; any additional face must be self-hosted and shell-scoped.
- The login's editorial two-panel direction is approved and must not be redesigned.

## Evidence on Hand

- Working Angular shell with live API, dynamic menu, branding and RBAC.
- Existing screenshots in `docs/screenshots/` (dashboard, patients, login, settings, agenda, quotes).
- Real seeded data and a running local stack (:3000, :4200–:4206).
- No testimonials, benchmark claims or marketing assets need to be invented for this internal surface.

## Product Principles

1. Orientation before decoration: the user must know where they are and what the next action is at a glance.
2. Density with air: the shell supports long sessions, so hierarchy and rhythm matter more than ornament.
3. One primary action per region; everything else recedes.
4. The clinic's identity, not the product's, is what the chrome expresses.
5. Every state (loading, failed remote, forbidden, empty, collapsed, mobile) is designed, not left to chance.

## Accessibility & Inclusion

- Keyboard-first navigation, visible focus, landmarks, skip link and correct `aria-current`.
- Touch targets of at least 44px on mobile; the drawer traps focus and closes with Escape.
- Contrast must hold for arbitrary clinic primary/accent colours in both themes.
- `prefers-reduced-motion` respected for any shell animation.
