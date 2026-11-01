'use client';

import { Button } from '@primereact/ui/button';
import { DataTable } from '@primereact/ui/datatable';
import { Empty, ErrorState, Loading } from './PageStates';

export interface Column<T> {
  key: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  align?: 'left' | 'right';
}

/**
 * Table for server-driven lists: sorting and filtering happen in the query the page owns, the grid
 * only shows what it is given and offers "Mehr laden" for the next cursor page.
 */
export function DataGrid<T extends object>({
  data,
  columns,
  rowKey,
  loading = false,
  error,
  empty = 'Keine Einträge vorhanden.',
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  caption,
  rowTestId,
}: {
  data: T[];
  columns: Column<T>[];
  rowKey: (item: T) => string;
  loading?: boolean;
  error?: string | null;
  empty?: React.ReactNode;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  caption?: string;
  rowTestId?: string;
}) {
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (data.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="stack">
      <DataTable.Root data={data}>
        <DataTable.TableContainer>
          <DataTable.Table aria-label={caption}>
            <DataTable.THead>
              <DataTable.THeadRow>
                {columns.map((c) => (
                  <DataTable.THeadCell key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                    {c.header}
                  </DataTable.THeadCell>
                ))}
              </DataTable.THeadRow>
            </DataTable.THead>
            <DataTable.TBody>
              {({ item }: { item: T }) => (
                <DataTable.Row key={rowKey(item)} data-testid={rowTestId}>
                  {columns.map((c) => (
                    <DataTable.Cell key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                      {c.cell(item)}
                    </DataTable.Cell>
                  ))}
                </DataTable.Row>
              )}
            </DataTable.TBody>
          </DataTable.Table>
        </DataTable.TableContainer>
      </DataTable.Root>
      {hasMore ? (
        <div>
          <Button variant="outlined" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Lädt …' : 'Mehr laden'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
