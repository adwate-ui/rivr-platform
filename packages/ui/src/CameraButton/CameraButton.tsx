import { useRef, type ReactNode } from 'react';
import { Button, type ButtonVariant } from '../Button/Button.tsx';

export interface CameraButtonProps {
  /** The label: a verb, sentence case, such as "Take a selfie". */
  children: ReactNode;
  /** The photo the member took, or chose from the phone. */
  onPhoto: (photo: File) => void;
  /** `user` opens the front camera, for a selfie; `environment` the back one, for a document. */
  camera?: 'user' | 'environment';
  variant?: ButtonVariant;
  /** Shows the loading label while the photo is sent. */
  isLoading?: boolean;
  fullWidth?: boolean;
}

/**
 * A button that opens the phone's camera and hands back the photo. On a computer it opens the file
 * picker. The file input behind it is hidden; the button is what people and screen readers use.
 */
export function CameraButton({ children, onPhoto, camera = 'user', ...button }: CameraButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button {...button} onClick={() => input.current?.click()}>
        {children}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture={camera}
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const photo = event.target.files?.[0];
          // Cleared, so taking the same photo again still counts as a change.
          event.target.value = '';
          if (photo) onPhoto(photo);
        }}
      />
    </>
  );
}
