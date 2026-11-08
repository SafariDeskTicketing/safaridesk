# Design Quality and Anti-AI-Slop Principles

Read this before any `/impeccable` pass (audit, harden, polish, colorize, distill, etc.) or any other UI/UX work on this codebase. It's the philosophy layer above `design-guidelines.md`'s concrete tokens — use both together.

---

### 1. Design with Intent
- Treat every interface as a functional product, not a visual exercise.
- Understand the application's purpose, target users, workflows and information architecture before designing.
- Every component, element, metric, label and interaction must have a clear reason to exist.
- Be able to explain why information is grouped, ordered, positioned and presented in a particular way.
- Do not invent content, statistics, features, actions or functionality to make an interface appear complete.
- Prioritize actual user needs over visual decoration.

### 2. Reject Generic AI Design Patterns
Do not automatically default to:
- Equal-sized metric cards across the top of dashboards.
- Excessive rounded containers, borders and nested cards.
- Decorative gradients, glows and purple/blue colour schemes.
- Arbitrary uppercase eyebrow headings with excessive letter spacing.
- Large numbers accompanied by meaningless labels.
- Decorative icons that communicate no additional information.
- Unnecessary subtitles, status indicators and redundant metadata.
- Repetitive layouts that make every section look identical.
- Generic dashboard templates regardless of the application's purpose.

These patterns are not universally prohibited. Use them when the actual product requirements justify them.

### 3. Information Hierarchy and Density
- Establish a deliberate visual hierarchy.
- Group related information using proximity, alignment, typography and whitespace.
- Use whitespace purposefully rather than filling every available space.
- Make important information immediately discoverable.
- Do not give transient data more visual prominence than the labels and context needed to understand it.
- Match information density to the product's actual usage.
- Operational interfaces, monitoring dashboards and enterprise tools may require high information density. Do not sacrifice useful information density for minimalist aesthetics.
- Avoid unnecessary borders, dividers, containers and visual separators.

### 4. Typography and Visual Language
- Use typography to communicate hierarchy and meaning, not to decorate.
- Avoid arbitrary font combinations, excessive tracking, unnecessary uppercase text and decorative monospace typography.
- Maintain consistent spacing, alignment, sizing and typography.
- Do not assume a dark theme, light theme, minimalism or a particular colour palette is inherently better.
- Develop a visual language appropriate to the product, its audience and its context.
- Preserve personality and distinction without compromising usability.

### 5. Functional UX Before Visual Polish
- Design around real user workflows and expected outcomes.
- Consider loading, empty, error, success, disabled and partial-data states.
- Consider what happens when data changes, grows, disappears or becomes unavailable.
- Ensure actions, controls and navigation communicate their actual purpose.
- Avoid displaying information that users cannot meaningfully interpret or act upon.
- Consider accessibility, keyboard navigation, contrast and responsive behaviour.
- Never confuse a visually attractive interface with a usable one.

### 6. Critical Evaluation and Iteration
- Do not accept the first generated design as the final design.
- Critically evaluate every design decision.
- Do not perform superficial redesigns by merely changing colours, gradients, border radii or shadows.
- When improving an existing interface, identify the underlying UX, information architecture and visual hierarchy problems first.
- Preserve established design conventions where they improve usability.
- Introduce originality through intentional product decisions, not arbitrary visual novelty.
- Remove elements that do not contribute meaningful value.

### 7. Implementation Discipline
- Do not introduce additional dependencies, components, abstractions or complexity without justification.
- Reuse established project conventions and existing design-system components where appropriate.
- Maintain consistency across the application.
- Do not sacrifice accessibility, maintainability or functional correctness for visual effects.
- Build real functionality rather than static representations of functionality.

### Core Principle
Do not optimize for looking like a professionally designed AI-generated interface. Optimize for being a genuinely well-designed product.

Every design decision should be defensible in terms of usability, information architecture, functionality, accessibility or visual communication.

---

## Specifically for SafariDesk (and similar operational/enterprise tools)

### A. This is enterprise software, not a marketing website
An operational dashboard (ticket list, agent dashboard, SLA view, admin console) should optimize for:
- Information density.
- Scannability.
- Fast identification of abnormal conditions.
- Clear operational states.
- Efficient workflows.

Don't turn an operational interface into a landing page with five pretty cards.

### B. Don't invent data to fill space
This is one of the worst AI coding habits. If a dashboard "needs" a metric — uptime %, active user count, SLA compliance %, pending ticket count — ask: where does this number come from? Is it real? Is it useful? Can the backend actually calculate it? (SafariDesk has a live example of the failure mode this causes: the dashboard's "SLA Breached"/"SLA Compliance %" tiles silently read a dead relation and always showed zero/100% until that was traced and fixed — see `AUDIT_TRACKER.md`.) If a metric can't be backed by a real, correct query, it doesn't belong on the screen.

### C. Don't make design decisions without understanding the product
Before implementing a screen, answer:
1. Who uses this screen?
2. What are they trying to accomplish?
3. What information do they need?
4. What decisions do they make using that information?
5. What happens when something goes wrong?

### D. Challenge your own output before presenting it
Don't just generate an interface and declare it polished. Review it as an experienced product designer would review another designer's work. Ask:
- Does this actually solve the user's problem?
- Is every element necessary?
- Is the hierarchy obvious?
- Am I using a familiar AI-generated layout without considering the context?
- Have I confused visual simplicity with usability?
- Would an experienced designer be able to explain the decisions behind this interface?

The goal isn't to make AI-generated interfaces look less AI-generated — it's to make better design decisions in the first place. That's a more useful bar than an anti-slop checklist.
