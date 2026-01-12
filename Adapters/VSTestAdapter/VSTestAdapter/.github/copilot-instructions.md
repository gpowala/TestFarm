# Copilot Instructions

## TDD Workflow (Red-Green-Refactor)

IMPORTANT!!! Always follow Test-Driven Development when creating or modifying code in this repository.

### For New Code
1. **RED**: Write failing tests first that define expected behavior
   - Run tests to verify they **actually fail** before proceeding
   - If tests pass, the test is not testing new behavior - revise the test
2. **GREEN**: Write minimum implementation to make tests pass
   - Run tests to confirm all tests **now pass**
   - If tests still fail, fix the implementation (never the tests)
3. **REFACTOR**: Clean up code without modifying tests
   - Perform **auto-retrospect** review (see below)
   - Present clear improvement suggestions
   - Apply refactoring based on retrospection
   - Run tests after each refactoring step to ensure they still pass

### For Existing Code Changes
1. Modify or add tests FIRST to reflect the desired change
2. **Run tests** - they should fail initially (implementation doesn't match yet)
3. If tests pass unexpectedly, the change may already exist or test is incorrect
4. Implement code changes to make tests pass
5. **Run tests** - verify all tests now pass
6. **NEVER modify tests after implementation begins** - tests are locked

---

## Plan-First TDD Workflow

IMPORTANT!!! Always create an explicit plan before making any code changes.** This ensures clear tracking of test vs implementation modifications.

### Phase 1: Create Plan

Before any code changes, create a plan that explicitly separates:
- **[TEST]** steps - modifications to test files only
- **[IMPL]** steps - modifications to implementation files only
- **[VERIFY]** steps - build and test verification
- **[REVIEW]** steps - code quality review and retrospection
- **[REFACTOR]** steps - implementation cleanup (tests remain locked)

### Phase 2: Execute Plan

#### For New Code (Red-Green-Refactor)
1. **[TEST] RED**: Write failing tests that define expected behavior
   - Only test files are modified in this step
   - Run tests to confirm they fail
2. **[IMPL] GREEN**: Write minimum implementation to make tests pass
   - Only implementation files are modified in this step
   - Tests are now locked - do not touch
3. **[VERIFY]**: Run build and all tests to confirm GREEN phase
4. **[REVIEW]**: Perform auto-retrospect (code quality review)
   - Identify code smells, SOLID violations, readability issues
   - Present improvement suggestions with priority and trade-offs
5. **[REFACTOR]**: Apply improvements to implementation code
   - Tests remain locked throughout refactoring
   - Run tests after each refactoring change
6. **[VERIFY]**: Final build and test verification

#### For Existing Code Changes
1. **[TEST]**: Modify or add tests FIRST to reflect desired behavior
   - Tests should fail initially
2. **[VERIFY]**: Confirm tests fail (RED phase)
3. **[IMPL]**: Implement code changes to make tests pass
   - Tests are now locked
4. **[VERIFY]**: Confirm tests pass (GREEN phase)
5. **[REVIEW]**: Perform auto-retrospect review
6. **[REFACTOR]**: Clean up implementation if needed
7. **[VERIFY]**: Final build and test verification

---

## SOLID Principles

All code must adhere to SOLID principles. These are especially important during the [REVIEW] phase.

### S - Single Responsibility Principle (SRP)
- Each class should have only one reason to change
- Each method should do one thing well
- Split classes that handle multiple concerns into focused components

### O - Open/Closed Principle (OCP)
- Classes should be open for extension but closed for modification
- Use abstractions (interfaces, abstract classes) to allow behavior extension
- Prefer composition and dependency injection over modifying existing code

### L - Liskov Substitution Principle (LSP)
- Subtypes must be substitutable for their base types
- Derived classes must not violate base class contracts
- Avoid throwing unexpected exceptions in overridden methods

### I - Interface Segregation Principle (ISP)
- Clients should not depend on interfaces they don't use
- Prefer many small, focused interfaces over large, monolithic ones
- Split fat interfaces into role-specific interfaces

### D - Dependency Inversion Principle (DIP)
- High-level modules should not depend on low-level modules; both should depend on abstractions
- Abstractions should not depend on details; details should depend on abstractions
- Use dependency injection to provide implementations

---

## Auto-Retrospect (Review Phase)

Before refactoring, perform a self-review and present findings:

### 1. Code Quality Review
- Identify code smells (duplication, long methods, poor naming)
- Check for SOLID principle violations
- Evaluate readability and maintainability

### 2. SOLID Principles Checklist
Review each principle and document any violations:

| Principle | Check For | Common Fixes |
|-----------|-----------|--------------|
| **SRP** | Classes with multiple responsibilities, methods doing too much | Extract classes, split methods |
| **OCP** | Direct modifications to add features, switch statements on types | Use strategy pattern, polymorphism |
| **LSP** | Overrides that change base behavior, type checks before calling | Redesign inheritance hierarchy |
| **ISP** | Unused interface members, "fat" interfaces | Split into focused interfaces |
| **DIP** | Direct instantiation of dependencies, concrete type references | Inject abstractions via constructor |

### 3. Present Improvement Suggestions
- List specific improvements with rationale
- Prioritize by impact (high/medium/low)
- Note any trade-offs
- **Flag SOLID violations explicitly** with the principle acronym (e.g., "[SRP] UserService handles both validation and persistence")

### 4. Apply Refactoring
- Implement improvements one at a time
- Address SOLID violations in priority order
- Run tests after each change to verify no regression
- Do NOT modify tests during refactoring

---

## Plan Format Example

```
## Steps
1. [TEST] Add unit tests for new validation logic
2. [VERIFY] Confirm tests fail (RED phase)
3. [IMPL] Implement validation method
4. [VERIFY] Confirm tests pass (GREEN phase)
5. [REVIEW] Perform code quality retrospect
6. [REFACTOR] Apply identified improvements
7. [VERIFY] Final build and test verification
```

---

## Critical Rules

- **Plan first** - No code changes without an explicit plan
- **Label every step** - Use [TEST], [IMPL], [VERIFY], [REVIEW], or [REFACTOR] prefixes
- **Tests are the source of truth** - Tests define correctness
- **Tests are locked after [IMPL] begins** - Never modify tests to fix failing implementation
- **Fix implementation, not tests** - If tests fail after implementation, the implementation is wrong
- **One phase at a time** - Complete all [TEST] steps before any [IMPL] steps
- **Always run tests at phase transitions** - RED→GREEN, GREEN→REFACTOR
- **Run build verification after changes** - Ensure code compiles
- **Follow SOLID principles** - All code must adhere to SOLID; violations must be flagged in [REVIEW]

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| Skipping the plan | Cannot track what changed and when |
| Mixing [TEST] and [IMPL] in one step | Obscures what was modified |
| Writing implementation before tests | Defeats TDD purpose |
| Modifying tests after implementation begins | Tests lose their role as source of truth |
| Unlabeled steps | Cannot verify proper execution order |
| Skipping the "red" phase | Tests must fail first to prove they test new behavior |
| Skipping test execution before GREEN phase | Cannot confirm tests actually fail |
| Touching tests during refactoring phase | Refactoring must not change behavior |
| Refactoring without running tests | Cannot verify no regression introduced |
| Skipping [REVIEW] phase | Misses improvement opportunities |
| Ignoring SOLID violations | Leads to rigid, fragile, and hard-to-maintain code |
| Creating "god classes" | Violates SRP, makes testing and maintenance difficult |
| Tight coupling to concrete implementations | Violates DIP, makes code hard to test and extend |

---

## Verification Checklist

After completing work, confirm:
- [ ] Plan was created before any code changes
- [ ] All steps were labeled with [TEST], [IMPL], [VERIFY], [REVIEW], or [REFACTOR]
- [ ] Tests were written/modified before implementation
- [ ] Tests failed initially (RED phase verified)
- [ ] No test modifications occurred after implementation began
- [ ] Code quality review was performed
- [ ] SOLID principles were checked and violations addressed**
- [ ] Refactoring applied with tests passing after each change
- [ ] Build passes
- [ ] All tests pass
