import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { PerspectiveCamera } from 'three/webgpu';
import { fitCamera } from './framing';

/** The default (forge) camera widens on narrow screens, like the other cameras. */
export default function Framing() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useLayoutEffect(() => {
    if (camera instanceof PerspectiveCamera) fitCamera(camera, size.width / size.height);
  }, [camera, size]);
  return null;
}
