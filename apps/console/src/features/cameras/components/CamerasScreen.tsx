import { useFloorTables, useStaffVenue, type FloorTable } from '@rivr/db';
import { useCameras, useSaveCamera, type Camera, type CameraFailure } from '@rivr/db/cctv';
import { t } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Screen, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { AddCameraForm } from './AddCameraForm.tsx';
import { CAMERA_FAILURE_COPY } from './cameraCopy.ts';

/**
 * The venue's CCTV cameras (#122; tech plan item 17; decision 0238), for staff who manage devices: each on the
 * recorder's channel, over a table, on the cage or elsewhere. A hand carries its table's camera, a cage transaction
 * the cage's, so their recording opens from Pot data and the cage's receipt.
 */
export function CamerasScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('devices.manage')) {
    return <Screen title={t('console.cameras.title')} status="error" errorText={t('console.cameras.notAllowed')} />;
  }
  return <Cameras venueId={staff.venue.venueId} />;
}

const watches = (camera: Camera) => camera.isCage ? t('console.cameras.cage') : camera.tableName ?? t('console.cameras.elsewhere');

function RetireButton({ venueId, camera, onFailure }: { venueId: string; camera: Camera; onFailure: (failure: CameraFailure | null) => void }) {
  const save = useSaveCamera(venueId);
  const retire = async () => {
    const done = await save.mutateAsync({ ...camera, isActive: false });
    onFailure(done.ok ? null : done.error);
  };
  return (
    <Button variant="text" isLoading={save.isPending} aria-label={t('console.cameras.retireLabel', { name: camera.name })} onClick={() => void retire()}>
      {t('console.cameras.retire')}
    </Button>
  );
}

function columns(venueId: string, onFailure: (failure: CameraFailure | null) => void): readonly DataTableColumn<Camera>[] {
  return [
    { key: 'name', header: t('console.cameras.name'), cell: (camera) => camera.name, sortValue: (camera) => camera.name },
    { key: 'channel', header: t('console.cameras.channel'), cell: (camera) => camera.channel },
    { key: 'watches', header: t('console.cameras.watches'), cell: watches, sortValue: watches },
    { key: 'status', header: t('console.cameras.status'), cell: (camera) => t(camera.isActive ? 'console.cameras.inUse' : 'console.cameras.retired') },
    // A row's button: no heading, so exports leave it out.
    { key: 'retire', header: '', cell: (camera) => camera.isActive ? <RetireButton venueId={venueId} camera={camera} onFailure={onFailure} /> : null },
  ];
}

function Cameras({ venueId }: { venueId: string }) {
  const cameras = useCameras(venueId);
  const tables = useFloorTables();
  const [failure, setFailure] = useState<CameraFailure | null>(null);
  const title = t('console.cameras.title');
  if (cameras.isPending || tables.isPending) return <Screen title={title} status="loading" />;
  if (cameras.data === undefined || tables.data === undefined) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([cameras.refetch(), tables.refetch()])} />;
  }
  const venueTables: readonly FloorTable[] = tables.data.filter((table) => table.venueId === venueId);
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Stack gap={3}>
          {failure === null ? null : <ErrorMessage>{t(CAMERA_FAILURE_COPY[failure])}</ErrorMessage>}
          <DataTable label={t('console.cameras.tableLabel')} columns={columns(venueId, setFailure)} rows={cameras.data}
            rowKey={(camera) => camera.cameraId} emptyText={t('console.cameras.empty')} />
        </Stack>
        <AddCameraForm venueId={venueId} tables={venueTables} />
      </Stack>
    </Screen>
  );
}
