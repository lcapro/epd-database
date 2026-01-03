import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui';

export default function UiPlaygroundPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>UI Playground</CardTitle>
          <CardDescription>Overzicht van de InfraImpact UI-kit componenten.</CardDescription>
        </CardHeader>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="brand">Brand</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formuliervelden</CardTitle>
          <CardDescription>Inputs met focus en error states.</CardDescription>
        </CardHeader>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input placeholder="Zoekterm" />
          <Select defaultValue="">
            <option value="">Selecteer</option>
            <option value="a">Optie A</option>
          </Select>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabellen</CardTitle>
          <CardDescription>Standaard layout met hover states.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Naam</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Voorbeeld item</TableCell>
                <TableCell>Actief</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <Alert variant="info">Info alert voor updates of bevestigingen.</Alert>

      <EmptyState title="Nog geen data" description="Voeg je eerste item toe om te starten." />
    </div>
  );
}
