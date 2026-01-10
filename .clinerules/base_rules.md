# Universal Programming Rules for AI Agents

**Purpose**: Establish comprehensive, actionable standards that ensure AI-generated code consistently meets the highest quality benchmarks across all programming languages and frameworks. These standards serve as both a guide and a mandate for code excellence.

**Audience**: AI agents and language models responsible for generating, modifying, or reviewing production code. These rules apply universally to any automated system that creates or influences code artifacts.

**Scope**: Core principles that transcend specific programming languages, with practical implementations tailored to each language's unique characteristics and conventions. The standards cover the entire software development lifecycle from initial design to maintenance.

---

## 🎯 The Ultimate Goal: Readability First

**The primary and ultimate goal of all code generation is READABILITY.** All rules, patterns, and standards that follow are fundamentally aimed at achieving this single objective.

**Priority Order:**

1. **Readability** - Code must be understood by humans, even the least experienced ones
2. **Stability** - Code should be reliable and predictable
3. **Robustness** - Code should handle edge cases and errors gracefully

**Why Readability Comes First:**

- Code is written once but read many times
- The "dumbest" human reader must be able to understand the code
- Unreadable code cannot be effectively maintained, debugged, or improved
- Stability and robustness are meaningless if no one can understand the code to achieve them

**All other rules in this document serve this ultimate goal.** When in doubt, choose the approach that maximizes human understanding.

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Code Organization](#2-code-organization)
3. [Documentation Standards](#3-documentation-standards)
4. [Logging Best Practices](#4-logging-best-practices)
5. [Quality Assurance](#5-quality-assurance)
6. [Quick Reference](#6-quick-reference)
7. [Empty Line Usage in Code Blocks and Documentation Comments](#7-empty-line-usage-in-code-blocks-and-documentation-comments)

---

## 1. Core Principles

### 1.1 Fundamental Rules

**Readability First**: Code is written once, read many times

- As established in the ultimate goal above, readability is the primary objective that precedes stability and robustness
- Prefer explicit over implicit
- Use descriptive names over comments when possible
- Optimize for human understanding, not just functionality

**Consistency**: Follow established patterns within the codebase

- Match existing code style first
- Apply these rules only when no conflicting patterns exist
- Maintain consistent abstraction levels

**Maintainability**: Design for change

- Single Responsibility Principle
- Minimize dependencies between components
- Make intent clear through structure

### 1.2 Universal Standards

**Line Length**: Maximum 120 characters

- Break long argument lists across lines
- Split complex expressions into intermediate variables
- Use trailing commas where language supports it

**Naming Conventions**: Follow language standards

- Functions/methods: verbs describing action (`getUserData`, `calculateTotal`)
- Variables: nouns describing content (`userData`, `totalAmount`)
- Constants: SCREAMING_SNAKE_CASE where conventional

**File Organization**: Consistent structure across languages

- Dependencies/imports at top
- Types/interfaces before implementation
- Public API before private implementation
- Related functionality grouped together

---

## 2. Code Organization

### 2.1 Extraction Decision Tree

```
Is code repeated 3+ times?
├─ YES → Extract immediately
└─ NO → Is it complex business logic?
   ├─ YES → Consider extraction if >15 lines
   └─ NO → Is it violating single responsibility?
      ├─ YES → Extract to separate function
      └─ NO → Keep inline
```

### 2.2 Function Design

**Size Limits**:

- Functions: 20-30 lines maximum
- Methods in classes: 15-25 lines maximum
- Exception: Simple property getters/setters can be longer

**Parameter Guidelines**:

- Maximum 4 parameters for functions
- Use objects/structs for more complex data
- Required parameters first, optional parameters last

**Complexity Thresholds**:

- Cyclomatic complexity ≤ 8
- Nesting depth ≤ 3 levels
- If exceeded, extract sub-functions

## 3 Three-Phase Processing Pattern

### 3.1 Three-Phase Processing Pattern (Condensed)

**When to Apply**: Use for functions exceeding 10 lines with clear, distinct phases.

| Phase         | Purpose                     | Example Steps                 |
| ------------- | --------------------------- | ----------------------------- |
| 1. Input      | Validate and prepare input  | Check params, apply defaults  |
| 2. Processing | Execute core business logic | Transform data, call APIs     |
| 3. Output     | Return or print result      | Format and return final value |

**Guidelines**:

- Use numeric comments (`// 1.`, `// 2.`, `// 3.`) inside function bodies only.
- Sub-steps: `1.1`, `2.2`, up to three levels deep.
- Numeric comments must only be used inside function or method bodies, never at the file, module, or global scope, and never on property declarations.
- Only the prefixes `1.`, `2.`, and `3.` are permitted:
  - `1.` is for input handling (validation, preparation). This phase corresponds to the "input" section in computer architecture, where data is received, checked, and prepared before processing.
  - `2.` is for core processing (business logic). This phase corresponds to the "processing" section in computer architecture, where the system computes, transforms, or manipulates the input data to produce the desired result. Numeric comments with the prefix `2.` should be used to annotate steps that perform calculations, transformations, or any business logic that processes the validated input.
  - `3.` is for output (return or print result). This phase corresponds to the "output" section in computer architecture, where the processing result is returned, printed, or otherwise delivered as the final output of the function or method. Numeric comments with the prefix `3.` should be used to annotate steps that handle the result of processing and produce the final output.
- Prefixes like `4.` or higher are invalid and must not be used.

### 3.2 Numeric Comment Placement Rules

**Numeric comments (e.g., `// 1.`, `// 2.`, `// 3.`) clarify processing steps and must follow strict placement rules:**

| Location                                      | Allowed |
| --------------------------------------------- | ------- |
| Inside a function or method body              | Yes     |
| Loop or conditional inside function/method    | Yes     |
| Outside any function or method (file/module)  | No      |
| Global scope (e.g., script-level statements)  | No      |
| Property or field declarations (class/object) | No      |

- Numeric comments are only permitted inside function or method bodies.
- They must not be used at file/module/global scope, on property/field declarations, or outside executable code blocks.
- Use numeric comments to clarify distinct processing phases within functions, following the three-phase pattern.

### 3.3 Valid Numeric Comment Usage Examples

```typescript example 1 - Simple Function
function example(input) {
  // 1. Input validation
  if (!input) throw new Error("Missing input");

  // 2. Core processing
  const result = process(input);

  // 3. Output
  return result;
}
```

```typescript example 2 - Multiple Numeric Comments
/**
 * Determines the truth value of a statement using double negation and logical NOT.
 * @param value - The input value to evaluate
 * @returns Boolean indicating the truthiness of the input
 */
function notNotNotTruth(value: unknown): boolean {
  // 1. Input handling
  // 1.1 Check for null or undefined
  if (value === null || value === undefined) {
    return false;
  }

  // 2. Core processing
  // 2.1 Apply double negation (!!) to get truthiness
  // 2.2 Apply logical NOT (!) to invert the result
  const truthValue = !!value;
  const inverted = !truthValue;

  // 3. Return result.
  return !inverted;
}
```

```typescript example 3 – Three-Phase Pattern with Nested Numeric Comments
/**
 * Processes a payment transaction with detailed validation, calculation, and logging.
 * @param payment - Payment details including amount and method
 * @returns Transaction result object
 * @throws {PaymentError} If validation or processing fails
 */
async function processPayment(
  payment: PaymentDetails,
): Promise<TransactionResult> {
  // 1. Input validation and preparation
  // 1.1 Check for missing payment details
  if (!payment || !payment.amount || !payment.method) {
    throw new PaymentError("Missing payment details");
  }

  // 1.2 Validate payment amount
  // 1.2.1 Ensure amount is positive
  if (payment.amount <= 0) {
    throw new PaymentError("Invalid payment amount");
  }

  // 1.2.2 Ensure supported payment method
  if (!["credit_card", "paypal", "bank_transfer"].includes(payment.method)) {
    throw new PaymentError("Unsupported payment method");
  }

  // 2. Core processing
  // 2.1 Calculate transaction fees
  // 2.1.1 Determine base fee
  const baseFee = payment.amount * 0.02;

  // 2.1.2 Apply method-specific surcharge
  const surcharge = payment.method === "credit_card" ? 1.5 : 0;

  // 2.2 Execute payment and log event
  try {
    // 2.2.1 Call external payment API
    const apiResult = await paymentApi.charge(payment);

    // 2.2.2 Log successful transaction
    logger.info("Payment processed", {
      paymentId: apiResult.id,
      amount: payment.amount,
    });
  } catch (error) {
    // 2.2.3 Log error and rethrow
    logger.error("Payment failed", { error, payment });
    throw new PaymentError("Payment processing failed");
  }

  // 3. Return transaction result
  return {
    status: "success",
    amount: payment.amount,
    fee: baseFee + surcharge,
  };
}
```

### 3.5 Invalid Usage Examples

```typescript
function badExample(input) {
  // 1. This must only handle input logic
  // 2. This must relate to core logic, not input/output
  // 3. This must only handle output (return/console)
  // 4. This is invalid – only 1, 2, 3 as prefix allowed, the 4th phase is not allowed.
}
```

---

## 3. Documentation Standards

### 3.1 Documentation Decision Matrix

| Code Element       | Documentation Required | Example               |
| ------------------ | ---------------------- | --------------------- |
| Public API         | Always                 | Full JSDoc/docstring  |
| Private methods    | If complex logic       | Brief purpose comment |
| Properties/Fields  | If not obvious         | Type and constraints  |
| Complex algorithms | Always                 | Algorithm explanation |
| Business rules     | Always                 | Why, not just what    |

### 3.2 Comment Placement Rules

**DO**:

- Document classes/types above declaration
- Document public functions with full API docs
- Use numbered comments inside function bodies only
- Explain WHY for business logic, not WHAT

**DON'T**:

- Add numbered comments at file scope
- Comment obvious code (`i++; // increment i`)
- Use numbered comments on property declarations
- Repeat information available in type signatures

### 3.3 Language-Specific Documentation

**JavaScript/TypeScript**: JSDoc format

```typescript
/**
 * Calculates user's total purchase amount including tax.
 * @param items - Array of purchase items
 * @param taxRate - Tax rate as decimal (0.08 = 8%)
 * @returns Total amount with tax applied
 * @throws {ValidationError} When items array is empty
 */
function calculateTotal(items: PurchaseItem[], taxRate: number): number {
  // 1. Input validation
  if (!items.length) throw new ValidationError("Items required");

  // 2. Core calculation
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal * (1 + taxRate);

  // 3. Output formatting
  return Math.round(total * 100) / 100;
}
```

## 4. Logging Best Practices

### 4.1 When to Log

- Log at key decision points: input validation failures, business rule triggers, external API calls, and error handling.
- Use logging to record important state changes, warnings, and exceptions.
- Avoid excessive logging in tight loops or trivial operations.

### 4.2 Logger Usage

- If a logger module is declared in the project, always use it for logging (e.g., `logger.error`, `logger.info`).
- Prefer structured logging (objects, context) over plain strings for easier analysis.
- If no logger is present, use the language's standard logging facility (e.g., `console.log`, `print`, etc.).

### 4.3 Log Level Guidelines

- Use ERROR for system failures and exceptions.
- Use WARN for recoverable issues and deprecated usage.
- Use INFO for significant business events and state changes.
- Use DEBUG for detailed execution flow (development only).

### 4.4 Example (TypeScript)

```typescript
/**
 * Processes user registration and logs key events.
 * @param user - User registration data
 * @returns Registration result
 */
async function registerUser(user: UserData): Promise<RegistrationResult> {
  // 1. Input validation
  if (!user.email) {
    logger.error("Registration failed: missing email", { user });
    throw new ValidationError("Email required");
  }

  // 2. Core processing
  logger.info("Registering user", { email: user.email });
  const result = await registrationService.register(user);

  // 3. Output handling
  logger.info("Registration successful", { userId: result.id });
  return result;
}
```

### 4.5 Logging Checklist

- [ ] Are errors and exceptions logged with context?
- [ ] Are important business events recorded?
- [ ] Is the declared logger module used if available?
- [ ] Are log levels appropriate for the message?
- [ ] Is sensitive information excluded from logs?

## 5. Quality Assurance

### 5.1 Code Review Checklist

**Functionality**:

- [ ] Does the code solve the intended problem?
- [ ] Are edge cases handled appropriately?
- [ ] Is error handling comprehensive?
- [ ] Are there any obvious bugs or logic errors?

**Design**:

- [ ] Does the code follow single responsibility principle?
- [ ] Are abstractions appropriate for the problem?
- [ ] Is the code extensible for future requirements?
- [ ] Are dependencies minimized and justified?

**Style**:

- [ ] Does code follow established project conventions?
- [ ] Are variable and function names descriptive?
- [ ] Is the code properly formatted and consistent?
- [ ] Are comments helpful and not redundant?

**Performance**:

- [ ] Are there any obvious performance bottlenecks?
- [ ] Is memory usage reasonable?
- [ ] Are database queries optimized?
- [ ] Is caching used appropriately?

### 5.2 Refactoring Triggers

**Extract Function When**:

- Function exceeds 25 lines
- Complex nested logic (>3 levels)
- Repeated code blocks (3+ times)
- Multiple responsibilities evident

**Extract Class When**:

- File exceeds 300 lines
- Multiple related functions operate on same data
- High coupling between function groups
- Clear domain concepts emerge

**Simplify When**:

- Cyclomatic complexity >8
- Parameter count >4
- Deep inheritance hierarchies (>3 levels)
- Excessive coupling between modules

### High Cohesion, Low Coupling

**Rule**:  
Design modules, classes, and functions so that each has a clear, focused responsibility (high cohesion) and minimal dependencies on other parts of the system (low coupling).

- Group related functionality together; avoid mixing unrelated concerns.
- Limit the number of external dependencies required by each module or function.
- Prefer passing only necessary data between components; avoid sharing global state.
- Refactor code that handles multiple unrelated tasks into separate, focused units.
- Changes in one module should have minimal impact on others.

**Why**:  
High cohesion improves maintainability and readability, while low coupling reduces the risk of unintended side effects and makes code easier to test and extend.

#### When to Apply High Cohesion and Low Coupling

| Situation                                              | Action Required          | Example/Fix                                     |
| ------------------------------------------------------ | ------------------------ | ----------------------------------------------- |
| Module/class handles unrelated responsibilities        | Split into focused units | Separate data access from business logic        |
| Function depends on many external modules              | Reduce dependencies      | Inject only needed services, not entire modules |
| Shared global state between components                 | Eliminate global state   | Pass data via parameters or context             |
| Changes in one module break others                     | Decouple modules         | Use interfaces or events for communication      |
| Function or class grows too large or complex           | Refactor for cohesion    | Extract sub-functions or classes                |
| Multiple unrelated tasks handled in one function/class | Separate concerns        | Move unrelated logic to new functions/classes   |
| Tight coupling to implementation details               | Abstract dependencies    | Depend on interfaces, not concrete classes      |

## 6. Quick Reference

### 6.1 Common Violations and Fixes

| Violation              | Fix                        | Example                                    |
| ---------------------- | -------------------------- | ------------------------------------------ |
| Function too long      | Extract sub-functions      | Split 50-line function into 3 smaller ones |
| Too many parameters    | Use parameter object       | `func(a,b,c,d,e)` → `func(options)`        |
| Unclear variable names | Use descriptive names      | `d` → `userRegistrationDate`               |
| Missing error handling | Add try/catch blocks       | Wrap API calls in error handling           |
| No input validation    | Validate at function start | Check types and ranges early               |

### 6.2 Decision Quick Reference

**Should I add a comment?**

- Is the WHY unclear from code? → Yes, add comment
- Is it complex business logic? → Yes, explain the rule
- Is it just describing WHAT code does? → No, improve code clarity instead

**Should I extract this code?**

- Used 3+ times? → Yes, extract immediately
- > 20 lines with clear purpose? → Yes, extract function
- Complex nested logic? → Yes, extract for clarity

**Should I add documentation?**

- Public API? → Yes, full documentation
- Complex algorithm? → Yes, explain approach
- Simple getter/setter? → No, type info sufficient

## 7. Empty Line Usage in Code Blocks and Documentation Comments

Use empty lines to visually separate distinct logical steps, categories, or unrelated properties in code blocks and documentation comments. This separation acts as a "period" in code, making boundaries between ideas clear and improving readability.

### Rule

- In documentation comments, end each sentence with a period.
- In code blocks, insert an empty line between lines that represent different logical steps or categories.

### Examples

#### Example 1: Logical Steps in Code

```typescript
function processOrder(order) {
  // Validate input
  if (!order) throw new Error("Order required");

  // Calculate totals
  const total = order.items.reduce((sum, item) => sum + item.price, 0);

  // Return result
  return { total };
}
```

#### Example 2: Configuration Properties

```json
{
  "host": "localhost",

  "port": 8080,

  "useSSL": false
}
```

#### Example 3: Documentation Comment

```typescript
/**
 * Processes an order.
 * Validates the input.
 * Calculates the total price.
 * Returns the result.
 */
```

### When to Use Empty Lines

| Situation                                  | Use Empty Line |
| ------------------------------------------ | -------------- |
| Between distinct logical steps in code     | Yes            |
| Between unrelated configuration properties | Yes            |
| Between sentences in documentation comment | Yes (period)   |
| Within tightly related code (same step)    | No             |
| Within grouped properties (same category)  | No             |

## 8. Memory Bank

I am AI agent, an expert software engineer with a unique characteristic: my memory resets completely between sessions. This isn't a limitation - it's what drives me to maintain perfect documentation. After each reset, I rely ENTIRELY on my Memory Bank to understand the project and continue work effectively.

**MANDATORY BEHAVIOR**: I MUST read ALL memory bank files at the start of EVERY conversation if the memory bank exists in the root `.memory-bank/` directory. This behavior is not optional - it is required to understand the project status and context before proceeding with any task.

**Location**: The Memory Bank is located in the `.memory-bank/` directory in the root of the project. If this directory exists, I MUST read all files within it before engaging in any task.

## Memory Bank Structure

The Memory Bank consists of core files and optional context files, all in Markdown format. Files build upon each other in a clear hierarchy:

flowchart TD
PB[projectbrief.md] --> PC[productContext.md]
PB --> SP[systemPatterns.md]
PB --> TC[techContext.md]

    PC --> AC[activeContext.md]
    SP --> AC
    TC --> AC

    AC --> P[progress.md]

### Core Files (Required)

1. `projectbrief.md`
   - Foundation document that shapes all other files
   - Created at project start if it doesn't exist
   - Defines core requirements and goals
   - Source of truth for project scope

2. `productContext.md`
   - Why this project exists
   - Problems it solves
   - How it should work
   - User experience goals

3. `activeContext.md`
   - Current work focus
   - Recent changes
   - Next steps
   - Active decisions and considerations
   - Important patterns and preferences
   - Learnings and project insights

4. `systemPatterns.md`
   - System architecture
   - Key technical decisions
   - Design patterns in use
   - Component relationships
   - Critical implementation paths

5. `techContext.md`
   - Technologies used
   - Development setup
   - Technical constraints
   - Dependencies
   - Tool usage patterns

6. `progress.md`
   - What works
   - What's left to build
   - Current status
   - Known issues
   - Evolution of project decisions

### Additional Context

Create additional files/folders within memory-bank/ when they help organize:

- Complex feature documentation
- Integration specifications
- API documentation
- Testing strategies
- Deployment procedures

## Core Workflows

### Plan Mode

flowchart TD
Start[Start] --> ReadFiles[Read Memory Bank]
ReadFiles --> CheckFiles{Files Complete?}

    CheckFiles -->|No| Plan[Create Plan]
    Plan --> Document[Document in Chat]

    CheckFiles -->|Yes| Verify[Verify Context]
    Verify --> Strategy[Develop Strategy]
    Strategy --> Present[Present Approach]

### Act Mode

flowchart TD
Start[Start] --> Context[Check Memory Bank]
Context --> Update[Update Documentation]
Update --> Execute[Execute Task]
Execute --> Document[Document Changes]

## Documentation Updates

Memory Bank updates occur when:

1. Discovering new project patterns
2. After implementing significant changes
3. When user requests with **update memory bank** (MUST review ALL files)
4. When context needs clarification

flowchart TD
Start[Update Process]

    subgraph Process
        P1[Review ALL Files]
        P2[Document Current State]
        P3[Clarify Next Steps]
        P4[Document Insights & Patterns]

        P1 --> P2 --> P3 --> P4
    end

    Start --> Process

Note: When triggered by **update memory bank**, I MUST review every memory bank file, even if some don't require updates. Focus particularly on activeContext.md and progress.md as they track current state.

REMEMBER: After every memory reset, I begin completely fresh. The Memory Bank is my only link to previous work. It must be maintained with precision and clarity, as my effectiveness depends entirely on its accuracy.
