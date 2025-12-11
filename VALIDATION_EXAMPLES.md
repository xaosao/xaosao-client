# Input Validation Examples

This document provides real-world examples of what inputs are **allowed** and **blocked** by the validation system.

## ✅ ALLOWED Examples

### Passwords with Special Characters
```javascript
"MyP@ssw0rd!#$"      // ✅ ALLOWED - Contains @, !, #, $
"Secure#Pass123!"    // ✅ ALLOWED - Contains #, !
"P@ssw0rd*2024"      // ✅ ALLOWED - Contains @, *
"MyP@ss(w0rd)123"    // ✅ ALLOWED - Contains @, (, )
```

### Bios with Common Punctuation
```javascript
"I'm a professional model (5+ years) & love music!"
// ✅ ALLOWED - Contains ', (, ), +, &, !

"Cost: $50/hr - Available Mon-Fri @ 9AM-5PM"
// ✅ ALLOWED - Contains $, /, -, @

"Model & Actress | Fashion enthusiast! #StayPositive"
// ✅ ALLOWED - Contains &, |, !, #

"Email: model@example.com | Phone: +856-20-1234567"
// ✅ ALLOWED - Contains @, |, +, -
```

### Addresses with Special Characters
```javascript
"Building #123, Street 456, District-7"
// ✅ ALLOWED - Contains #, ,, -

"Unit 5B, Floor 10, Tower A (East Wing)"
// ✅ ALLOWED - Contains ,, (, )

"123 Main St., Apt #45"
// ✅ ALLOWED - Contains ., #
```

### Careers with Special Characters
```javascript
"Software Developer @ Tech Company (2020-2024)"
// ✅ ALLOWED - Contains @, (, ), -

"CEO & Founder - Startup Inc."
// ✅ ALLOWED - Contains &, -, .

"Marketing Manager (Digital) | Social Media Expert"
// ✅ ALLOWED - Contains (, ), |
```

### Names with Hyphens
```javascript
"John-Paul"          // ✅ ALLOWED
"Mary-Jane"          // ✅ ALLOWED
"Jean-Pierre"        // ✅ ALLOWED
```

### Interests with Special Characters
```javascript
[
  "Music & Dance",          // ✅ ALLOWED - Contains &
  "Sports (Football)",      // ✅ ALLOWED - Contains (, )
  "Travel!",                // ✅ ALLOWED - Contains !
  "Photography @ Events",   // ✅ ALLOWED - Contains @
  "Cooking & Baking",       // ✅ ALLOWED - Contains &
]
```

---

## ❌ BLOCKED Examples

### Path Traversal Attempts
```javascript
"../../../etc/passwd"           // ❌ BLOCKED - Path traversal
"..\\windows\\system32"         // ❌ BLOCKED - Windows path traversal
"images//uploads//user"         // ❌ BLOCKED - Double slashes
"%2e%2e/sensitive"              // ❌ BLOCKED - URL-encoded traversal
```

### SQL Injection Attempts
```javascript
"admin' OR '1'='1"              // ❌ BLOCKED - Boolean-based SQL injection
"user'; DROP TABLE users--"    // ❌ BLOCKED - SQL command with terminator
"name' UNION SELECT * FROM passwords" // ❌ BLOCKED - UNION attack
"test'; DELETE FROM customers WHERE 1=1" // ❌ BLOCKED - SQL injection
"admin' AND 1=1--"              // ❌ BLOCKED - Boolean blind
```

### XSS/Script Tag Attempts
```javascript
"<script>alert('xss')</script>" // ❌ BLOCKED - Script tag
"Hello<img src=x onerror=alert(1)>" // ❌ BLOCKED - HTML tag with <, >
"<iframe src='evil.com'></iframe>" // ❌ BLOCKED - iframe tag
"Test<b>bold</b>"               // ❌ BLOCKED - Any HTML tag
"<div>content</div>"            // ❌ BLOCKED - div tag
```

### JavaScript Protocol Attempts
```javascript
"javascript:alert(1)"           // ❌ BLOCKED - JavaScript protocol
"vbscript:msgbox('xss')"        // ❌ BLOCKED - VBScript protocol
"data:text/html,<script>alert(1)</script>" // ❌ BLOCKED - Data URI
```

### Event Handler Attempts
```javascript
"Hello onclick='alert(1)'"     // ❌ BLOCKED - onclick event
"Text onerror='malicious()'"   // ❌ BLOCKED - onerror event
"eval('dangerous code')"        // ❌ BLOCKED - eval function
"expression(alert(1))"          // ❌ BLOCKED - CSS expression
```

---

## 🔍 Edge Cases

### Mathematical Expressions (ALLOWED)
```javascript
"Cost: $100 + tax (15%)"        // ✅ ALLOWED - Math symbols
"Price range: $50-$100"         // ✅ ALLOWED - Range with $, -
"Discount: 20% off!"            // ✅ ALLOWED - Percent with !
```

### Email Addresses (ALLOWED)
```javascript
"contact@example.com"           // ✅ ALLOWED - Email format
"user+tag@domain.co.uk"         // ✅ ALLOWED - Email with +
```

### Phone Numbers (ALLOWED)
```javascript
"+856-20-1234567"               // ✅ ALLOWED in bio/address
"(020) 1234-5678"               // ✅ ALLOWED in bio/address
```

### URLs (CONTEXT DEPENDENT)
```javascript
// ❌ In regular text fields (blocked due to //)
"https://example.com"           // ❌ BLOCKED - Contains //

// ✅ In profile field (validated as URL)
profile: "https://cdn.example.com/image.jpg"  // ✅ ALLOWED - URL field
```

### Apostrophes and Quotes (ALLOWED)
```javascript
"I'm a professional"            // ✅ ALLOWED - Apostrophe in text
"My nickname is 'Alex'"         // ✅ ALLOWED - Single quotes

// ❌ Only blocked in SQL injection context
"admin' OR '1'='1"              // ❌ BLOCKED - SQL injection pattern
```

---

## 📋 Field-Specific Rules

### Phone Number Field
```javascript
"2012345678"                    // ✅ ALLOWED - 10 digits
"20-1234-5678"                  // ✅ ALLOWED - Sanitized to 2012345678
"(020) 123-4567"                // ✅ ALLOWED - Sanitized to 2012345678

"1234567890"                    // ❌ BLOCKED - Starts with 1
"012345678"                     // ❌ BLOCKED - Only 9 digits
"20123456789"                   // ❌ BLOCKED - 11 digits
```

### Username Field
```javascript
"john_doe"                      // ✅ ALLOWED - Letters, underscore
"user.name"                     // ✅ ALLOWED - Letters, dot
"user-123"                      // ✅ ALLOWED - Letters, hyphen, numbers

"user@name"                     // ❌ BLOCKED - Contains @
"user name"                     // ❌ BLOCKED - Contains space
"user#123"                      // ❌ BLOCKED - Contains #
```

### Name Fields (First/Last Name)
```javascript
"John"                          // ✅ ALLOWED - English letters
"ສົມ​ຊາຍ"                       // ✅ ALLOWED - Lao characters
"Mary Jane"                     // ✅ ALLOWED - With space
"Jean-Pierre"                   // ✅ ALLOWED - With hyphen

"John123"                       // ❌ BLOCKED - Contains numbers
"John@"                         // ❌ BLOCKED - Contains @
```

### Password Field
```javascript
"MyPassword123"                 // ✅ ALLOWED - Has uppercase, lowercase, number
"SecureP@ss1"                   // ✅ ALLOWED - Special chars allowed
"P@ssw0rd!#$%"                  // ✅ ALLOWED - Multiple special chars

"password"                      // ❌ BLOCKED - No uppercase
"PASSWORD123"                   // ❌ BLOCKED - No lowercase
"Password"                      // ❌ BLOCKED - No number
"Pass123"                       // ❌ BLOCKED - Less than 8 characters
```

---

## 🎯 Summary

### Always Allowed
- Common special characters: `$ ! @ # % * ( ) - + _ , .`
- Apostrophes and quotes in normal text
- Email addresses (contains @)
- Mathematical expressions
- Hyphens in names

### Always Blocked
- Path traversal: `../`, `..\`, `//`
- HTML tags: `<`, `>`
- JavaScript protocols: `javascript:`, `vbscript:`
- SQL injection patterns
- Event handlers: `onclick=`, `onerror=`

### Context Dependent
- Single/double slashes: Blocked in regular fields, allowed in URL fields
- SQL keywords: Blocked only when combined with dangerous patterns
- Quotes: Allowed in text, blocked in SQL injection context
