# InfraImpact UI Guidelines

## Design tokens

### Kleuren
- **Brand**: `--brand-50` t/m `--brand-900`
- **Accent**: `--accent-50`, `--accent-500`, `--accent-700`
- **Neutrals**: `--gray-50` t/m `--gray-900`
- **Status**: `--success-500/700`, `--warning-500/700`, `--danger-500/700`

Gebruik Tailwind classes (`bg-brand-600`, `text-gray-700`, `border-gray-200`) waar mogelijk.

### Typografie
- Base font: `Inter`
- Headings: `text-2xl` t/m `text-4xl`, `font-semibold`
- Body: `text-sm` / `text-base` met `text-gray-600`
- Labels: `text-sm font-medium`

### Spacing
Gebruik de standaard schaal: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64` px.

### Radius & schaduw
- Radius: `rounded-xl` / `rounded-2xl`
- Shadows: `shadow-soft`

## Componenten

### Buttons
`Button` ondersteunt `primary`, `secondary`, `ghost`, `destructive` plus `loading` en `disabled`.

```tsx
<Button>Primair</Button>
<Button variant="secondary">Secundair</Button>
```

### Form fields
Gebruik `FormField` + `Input` / `Select` / `Textarea` voor consistente labels en errors.

```tsx
<FormField label="Productnaam" required>
  <Input value={value} onChange={...} />
</FormField>
```

### Cards & Alerts
`Card` voor sectioning, `Alert` voor feedback en fouten.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Titel</CardTitle>
    <CardDescription>Uitleg</CardDescription>
  </CardHeader>
</Card>
```

### Tables
Gebruik `Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell`.

### Overige
- `Badge` voor contextlabels.
- `EmptyState` voor lege results.
- `Pagination` voor lijsten.
