import axios from "axios";
import { ERROR_GENERATE_IMG_FAILED } from "./enum";
import {
  RequestOpts,
  GetModelsResponse,
  Img2imgRequest,
  NovitaConfig,
  ProgressRequest,
  ProgressResponse,
  ResponseCodeV2,
  SyncConfig,
  Txt2ImgRequest,
  Txt2ImgResponse,
  UpscaleResponse,
  UpscalseRequest,
  OutpaintingRequest,
  OutpaintingResponse,
  ResponseCodeV3,
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
  lcmTxt2ImgRequest,
  lcmTxt2ImgResponse,
} from "./types";
import { addLoraPrompt, generateLoraString, readImgtoBase64 } from "./util";
import { NovitaError } from "./error";

const Novita_Config: NovitaConfig = {
  BASE_URL: "https://api.novita.ai",
  key: undefined,
};

export function setNovitaKey(key: string) {
  Novita_Config.key = key;
}

export function setBaseUrl(url: string) {
  Novita_Config.BASE_URL = url
}

export function httpFetch({
  url = "",
  method = "GET",
  data = undefined,
  query = undefined,
  opts = undefined,
}: {
  url: string;
  method?: string;
  data?: Record<string, any> | undefined;
  query?: Record<string, any> | undefined;
  opts?: RequestOpts
}) {
  let fetchUrl = Novita_Config.BASE_URL + url;

  if (query) {
    fetchUrl += "?" + new URLSearchParams(query).toString();
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Novita-Source": opts?.source || `js-sdk-novita/${process.env.VERSION}`,
  }
  if (Novita_Config.key) {
    headers["Authorization"] = Novita_Config.key
  }

  return axios({
    url: fetchUrl,
    method: method,
    headers: headers,
    data: data,
    params: query,
    signal: opts?.signal
  })
    .then((response) => response.data)
    .catch((error) => {
      throw new Error(error.response ? error.response.data : error.message);
    });
}

export function httpFetchV3({
  url,
  method = "GET",
  data = undefined,
  query = undefined,
  opts = undefined,
}: {
  url: string;
  method?: string;
  data?: any;
  query?: any;
  opts?: RequestOpts;
}) {
  let fetchUrl = Novita_Config.BASE_URL + url;
  if (query) {
    fetchUrl += new URLSearchParams(query).toString();
  }
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Novita-Source": opts?.source || `js-sdk-novita/${process.env.VERSION}`,
  }
  if (Novita_Config.key) {
    headers["Authorization"] = Novita_Config.key
  } else {
    headers["X-Novita-Auth-Type"] = "anon"
  }

  return axios({
    url: fetchUrl,
    method: method,
    headers: headers,
    data: data,
    params: query,
  })
    .then((response) => {
      if (response.status !== ResponseCodeV3.OK) {
        throw new NovitaError(response.status, response.data.message, response.data.reason, response.data.metadata)
      }
      return response.data
    })
    .catch((error) => {
      if (error instanceof NovitaError) {
        throw error
      }
      const res = error.response
      if (res) {
        throw new NovitaError(res.status, res.data.message, res.data.reason, res.data.metadata, error)
      }
      throw new NovitaError(-1, error.message, '', undefined, error)
    });
}

export function getModels() {
  return httpFetch({
    url: "/v2/models",
  }).then((res: GetModelsResponse) => {
    if (res.code !== ResponseCodeV2.OK) {
      throw new NovitaError(res.code, res.msg);
    }
    return res.data;
  });
}

export function txt2Img(params: Txt2ImgRequest, opts?: RequestOpts) {
  return httpFetch({
    url: "/v2/txt2img",
    method: "POST",
    data: {
      ...params,
      prompt: addLoraPrompt(generateLoraString(params.lora), params.prompt),
    },
    opts,
  }).then((res: Txt2ImgResponse) => {
    if (res.code !== ResponseCodeV2.OK) {
      throw new NovitaError(res.code, res.msg);
    }
    return res.data;
  });
}

export function img2img(params: Img2imgRequest, opts?: RequestOpts) {
  return httpFetch({
    url: "/v2/img2img",
    method: "POST",
    data: {
      ...params,
      prompt: addLoraPrompt(generateLoraString(params.lora), params.prompt),
    },
    opts,
  }).then((res: Txt2ImgResponse) => {
    if (res.code !== ResponseCodeV2.OK) {
      throw new NovitaError(res.code, res.msg);
    }
    return res.data;
  });
}

export function upscale(params: UpscalseRequest, opts?: RequestOpts) {
  return httpFetch({
    url: "/v2/upscale",
    method: "POST",
    data: {
      ...params,
      upscaler_1: params.upscaler_1 ?? "R-ESRGAN 4x+",
      upscaler_2: params.upscaler_2 ?? "R-ESRGAN 4x+",
    },
    opts,
  }).then((res: UpscaleResponse) => {
    if (res.code !== ResponseCodeV2.OK) {
      throw new NovitaError(res.code, res.msg);
    }
    return res.data;
  });
}

export function progress(params: ProgressRequest, opts?: RequestOpts) {
  return httpFetch({
    url: "/v2/progress",
    method: "GET",
    query: {
      ...params,
    },
    opts,
  }).then((res: ProgressResponse) => {
    if (res.code !== ResponseCodeV2.OK) {
      throw new NovitaError(res.code, res.msg);
    }
    return res.data;
  });
}

export function txt2ImgSync(
  params: Txt2ImgRequest,
  config?: SyncConfig,
  opts?: RequestOpts,
): Promise<any> {
  return new Promise((resolve, reject) => {
    txt2Img({
      ...params,
      prompt: addLoraPrompt(generateLoraString(params.lora), params.prompt),
      opts,
    })
      .then((res) => {
        if (res && res.task_id) {
          const timer = setInterval(async () => {
            try {
              const progressResult = await progress({ task_id: res.task_id }, opts);
              if (progressResult && progressResult.status === 2) {
                clearInterval(timer);
                let imgs = progressResult.imgs;
                if (config?.img_type === "base64") {
                  imgs = await Promise.all(
                    progressResult.imgs.map((url) => readImgtoBase64(url))
                  );
                }
                resolve(imgs);
              } else if (
                progressResult &&
                (progressResult.status === 3 || progressResult.status === 4)
              ) {
                clearInterval(timer);
                reject(
                  new NovitaError(
                    0,
                    progressResult.failed_reason ?? ERROR_GENERATE_IMG_FAILED,
                    '',
                    { task_status: progressResult.status },
                  )
                );
              }
            } catch (error) {
              clearInterval(timer);
              reject(error);
            }
          }, config?.interval ?? 1000);
        } else {
          reject(new NovitaError(-1, "Failed to start the task."));
        }
      })
      .catch(reject);
  });
}

export function img2imgSync(
  params: Img2imgRequest,
  config?: SyncConfig,
  opts?: RequestOpts,
): Promise<any> {
  return new Promise((resolve, reject) => {
    img2img({
      ...params,
      prompt: addLoraPrompt(generateLoraString(params.lora), params.prompt),
    }, opts)
      .then((res) => {
        if (res && res.task_id) {
          const timer = setInterval(async () => {
            try {
              const progressResult = await progress({ task_id: res.task_id }, opts);
              if (progressResult && progressResult.status === 2) {
                clearInterval(timer);
                let imgs = progressResult.imgs;
                if (config?.img_type === "base64") {
                  imgs = await Promise.all(
                    progressResult.imgs.map((url) => readImgtoBase64(url))
                  );
                }
                resolve(imgs);
              } else if (
                progressResult &&
                (progressResult.status === 3 || progressResult.status === 4)
              ) {
                clearInterval(timer);
                reject(
                  new NovitaError(
                    0,
                    progressResult.failed_reason ?? ERROR_GENERATE_IMG_FAILED,
                    '',
                    { task_status: progressResult.status },
                  )
                );
              }
            } catch (error) {
              clearInterval(timer);
              reject(error);
            }
          }, config?.interval ?? 1000);
        } else {
          reject(new NovitaError(-1, "Failed to start the task."));
        }
      })
      .catch(reject);
  });
}

export function upscaleSync(params: UpscalseRequest, config?: SyncConfig, opts?: RequestOpts) {
  return new Promise((resolve, reject) => {
    upscale({
      ...params,
      upscaler_1: params.upscaler_1 ?? "R-ESRGAN 4x+",
      upscaler_2: params.upscaler_2 ?? "R-ESRGAN 4x+",
    }, opts)
      .then((res) => {
        if (res && res.task_id) {
          const timer = setInterval(async () => {
            try {
              const progressResult = await progress({ task_id: res.task_id }, opts);
              if (progressResult && progressResult.status === 2) {
                clearInterval(timer);
                let imgs = progressResult.imgs;
                if (config?.img_type === "base64") {
                  imgs = await Promise.all(
                    progressResult.imgs.map((url) => readImgtoBase64(url))
                  );
                }
                resolve(imgs);
              } else if (
                progressResult &&
                (progressResult.status === 3 || progressResult.status === 4)
              ) {
                clearInterval(timer);
                reject(
                  new NovitaError(
                    0,
                    progressResult.failed_reason ?? ERROR_GENERATE_IMG_FAILED,
                    '',
                    { task_status: progressResult.status },
                  )
                );
              }
            } catch (error) {
              clearInterval(timer);
              reject(error);
            }
          }, config?.interval ?? 1000);
        } else {
          reject(new NovitaError(-1, "Failed to start the task."));
        }
      })
      .catch(reject);
  });
}

function apiRequestV3<T, R>(url: string): (p: T, o?: RequestOpts) => Promise<R> {
  return (params: T, opts?: any): Promise<R> => {
    return httpFetchV3({
      url: url,
      method: "POST",
      data: params,
      opts,
    }).then((res: any) => {
      if (res.code && res.code !== ResponseCodeV3.OK) {
        throw new NovitaError(res.code, res.message || '', res.reason, res.metadata);
      }
      return res;
    });
  }
}

export const cleanup: (p: CleanupRequest, opts?: any) => Promise<CleanupResponse> =
  apiRequestV3<CleanupRequest, CleanupResponse>("/v3/cleanup")

export const outpainting: (p: OutpaintingRequest, opts?: any) => Promise<OutpaintingResponse> =
  apiRequestV3<OutpaintingRequest, OutpaintingResponse>("/v3/outpainting")

export const removeBackground: (p: RemoveBackgroundRequest, opts?: any) => Promise<RemoveBackgroundResponse> =
  apiRequestV3<RemoveBackgroundRequest, RemoveBackgroundResponse>("/v3/remove-background")

export const replaceBackground: (p: ReplaceBackgroundRequest, opts?: any) => Promise<ReplaceBackgroundResponse> =
  apiRequestV3<ReplaceBackgroundRequest, ReplaceBackgroundResponse>("/v3/replace-background")

export const mixpose: (p: MixPoseRequest, opts?: any) => Promise<MixPoseResponse> =
  apiRequestV3<MixPoseRequest, MixPoseResponse>("/v3/mix-pose")

export const doodle: (p: DoodleRequest, opts?: any) => Promise<DoodleResponse> =
  apiRequestV3<DoodleRequest, DoodleResponse>("/v3/doodle")

export const lcmTxt2Img: (p: lcmTxt2ImgRequest, opts?: any) => Promise<lcmTxt2ImgResponse> =
  apiRequestV3<lcmTxt2ImgRequest, lcmTxt2ImgResponse>("/v3/lcm-txt2img")
