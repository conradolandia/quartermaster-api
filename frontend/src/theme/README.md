# Quartermaster Dark Theme Guide

This guide explains how to use the custom dark theme colors in the Quartermaster application.

## Theme Overview

The Quartermaster application uses a dark theme with:
- **Primary Background**: Deep blue-gray (#19232d)
- **Secondary Background**: Lighter blue-gray (#32414b)
- **Accent Background**: Dark gray (#333333)
- **Primary Text**: White (#ffffff)
- **Secondary Text**: Light gray (#eeeeee)
- **Accent Color**: Orange (#fda801)

## Available Color Palettes

### 1. Dark Theme Colors (`dark`)

#### Text Colors (`dark.text`)
- `dark.text.primary` - Primary text (#ffffff)
- `dark.text.secondary` - Secondary text (#eeeeee)
- `dark.text.muted` - Muted text (#a0a0a0)
- `dark.text.disabled` - Disabled text (#666666)

#### Background Colors (`dark.bg`)
- `dark.bg.primary` - Main background (#19232d)
- `dark.bg.secondary` - Card/surface backgrounds (#32414b)
- `dark.bg.accent` - Accent backgrounds (#333333)
- `dark.bg.hover` - Hover state backgrounds (#3a4a57)
- `dark.bg.active` - Active state backgrounds (#4a5a67)

#### Accent Colors (`dark.accent`)
- `dark.accent.primary` - Main accent color (#fda801)
- `dark.accent.hover` - Hover state (#e69500)
- `dark.accent.active` - Active state (#cc8400)
- `dark.accent.light` - Light variant (#fdb835)
- `dark.accent.dark` - Dark variant (#d48f00)

#### Border Colors (`dark.border`)
- `dark.border.default` - Subtle borders (#404040)
- `dark.border.accent` - Prominent borders (#32414b)
- `dark.border.focus` - Focus states (#fda801)

#### Status Colors (`dark.status`)
- `dark.status.success` - Success states (#4caf50)
- `dark.status.warning` - Warning states (#ff9800)
- `dark.status.error` - Error states (#f44336)
- `dark.status.info` - Info states (#2196f3)

### 2. Brand Colors (`brand`)
Orange-based palette for accent elements:
- `brand.50` to `brand.900` - Full orange color scale
- `brand.500` - Main accent color (#fda801)

### 3. Semantic Tokens
Pre-defined semantic mappings for consistent usage:
- `bg.canvas` - Main page background
- `bg.surface` - Card/surface backgrounds
- `bg.accent` - Accent backgrounds
- `text.primary` - Primary text
- `text.secondary` - Secondary text
- `text.muted` - Muted text
- `text.disabled` - Disabled text
- `border.default` - Default borders
- `border.accent` - Accent borders
- `border.focus` - Focus states
- `accent.default` - Default accent
- `accent.hover` - Hover accent
- `accent.active` - Active accent
- `status.*` - Status colors

## Usage Examples

### In Components

```tsx
// Using dark theme colors directly
<Box bg="dark.bg.primary" color="dark.text.primary">
  <Text color="dark.text.secondary">Secondary text</Text>
  <Button bg="dark.accent.primary" color="dark.bg.primary">
    Accent Button
  </Button>
</Box>

// Using semantic tokens (recommended)
<Box bg="bg.canvas" color="text.primary">
  <Card>
    <CardBody bg="bg.surface" borderColor="border.default">
      <Text color="text.secondary">Secondary text</Text>
      <Text color="text.muted">Muted text</Text>
    </CardBody>
  </Card>
</Box>

// Using status colors
<Badge bg="status.success" color="white">Success</Badge>
<Alert bg="status.error" color="white">Error message</Alert>
<Text color="status.warning">Warning text</Text>
```

### Button Variants

The dark theme includes several button variants:
- `solid` (default) - Orange accent button with dark text
- `ghost` - Transparent with orange text
- `outline` - Orange outline button
- `secondary` - Blue-gray background button
- `success` - Green success button
- `danger` - Red danger button
- `warning` - Orange warning button
- `info` - Blue info button

```tsx
<Button variant="solid">Primary Action</Button>
<Button variant="ghost">Ghost Button</Button>
<Button variant="outline">Outline Button</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="success">Save</Button>
<Button variant="danger">Delete</Button>
<Button variant="warning">Warning</Button>
<Button variant="info">Info</Button>
```

### Button Sizes

Available button sizes:
```tsx
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
```

### Color Combinations

#### High Contrast Text
```tsx
<Text color="dark.text.primary" bg="dark.bg.primary">
  High contrast primary text
</Text>
<Text color="dark.text.secondary" bg="dark.bg.secondary">
  Secondary text on secondary background
</Text>
```

#### Accent Elements
```tsx
<Box bg="dark.accent.primary" color="dark.bg.primary">
  Accent background with dark text
</Box>
<Link color="dark.accent.primary" _hover={{ color: "dark.accent.hover" }}>
  Accent colored link
</Link>
```

#### Status Indicators
```tsx
<Badge bg="dark.status.success" color="white">Success</Badge>
<Badge bg="dark.status.warning" color="dark.bg.primary">Warning</Badge>
<Badge bg="dark.status.error" color="white">Error</Badge>
<Badge bg="dark.status.info" color="white">Info</Badge>
```

## Customizing the Dark Theme

To modify the dark theme colors, edit `frontend/src/theme.tsx`:

1. **Direct Colors**: Modify colors in the `tokens.colors.dark` section
2. **Semantic Tokens**: Update semantic mappings in `semanticTokens.colors`
3. **Component Recipes**: Modify component-specific styling in recipe files

## Best Practices

1. **Use semantic tokens** for consistent color usage across components
2. **Maintain proper contrast** between background and text colors
3. **Use accent colors sparingly** for important actions and highlights
4. **Test accessibility** with color contrast analyzers
5. **Consider hover and focus states** for interactive elements
6. **Use status colors** for feedback and state indicators
7. **Keep the color palette cohesive** throughout the application

## Accessibility Notes

- All text/background combinations meet WCAG AA contrast requirements
- Focus states use the accent color for visibility
- Status colors are chosen for colorblind accessibility
- Interactive elements have clear hover/active states
