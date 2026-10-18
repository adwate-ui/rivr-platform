const LONGEST_SIDE = 1024;
const QUALITY = 0.85;

/**
 * A photo from the phone's camera, made small enough to send: a JPEG at most 1024 px on its longest
 * side, about 150 KB, which is plenty for liveness and face match. Rejects a file that is not an image.
 */
export async function shrinkPhoto(photo: Blob): Promise<Blob> {
  const image = await createImageBitmap(photo);
  const scale = Math.min(1, LONGEST_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('The photo could not be read'))), 'image/jpeg', QUALITY);
  });
}
