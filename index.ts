export {
  setNovitaKey,
  getModels,
  img2img,
  txt2Img,
  txt2ImgSync,
  img2imgSync,
  upscale,
  upscaleSync,
} from "./src/client";

export { NovitaSDK } from "./src/class";

export {
  Txt2ImgRequest,
  Txt2ImgResponse,
  Img2imgRequest,
  Img2imgResponse,
  GetModelsResponse,
  SyncConfig,
  UpscaleResponse,
  UpscalseRequest,
  OutpaintingRequest,
  OutpaintingResponse,
  RemoveBackgroundRequest,
  RemoveBackgroundResponse,
  ReplaceBackgroundRequest,
  ReplaceBackgroundResponse,
  CleanupRequest,
  CleanupResponse,
  MixPoseRequest,
  MixPoseResponse,
  DoodleRequest,
  DoodleResponse,
} from "./src/types";

export { ControlNetPreprocessor, ControlNetMode, ModelType } from "./src/enum";
