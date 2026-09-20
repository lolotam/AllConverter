import { readdir } from "node:fs/promises";
import { Cookie } from "elysia";
import db from "../db/db";
import { normalizeFiletype, normalizeOutputFiletype } from "../helpers/normalizeFiletype";
import { conversionQueue } from "../helpers/queue";
import { forgetJob, trackFinished, trackPercent, trackQueued, trackStarted } from "./progress";
import { convert as convertassimp, properties as propertiesassimp } from "./assimp";
import { convert as convertCalibre, properties as propertiesCalibre } from "./calibre";
import { convert as convertDasel, properties as propertiesDasel } from "./dasel";
import { convert as convertDvisvgm, properties as propertiesDvisvgm } from "./dvisvgm";
import { convert as convertFFmpeg, properties as propertiesFFmpeg } from "./ffmpeg";
import {
  convert as convertGraphicsmagick,
  properties as propertiesGraphicsmagick,
} from "./graphicsmagick";
import { convert as convertImagemagick, properties as propertiesImagemagick } from "./imagemagick";
import { convert as convertInkscape, properties as propertiesInkscape } from "./inkscape";
import { convert as convertLibheif, properties as propertiesLibheif } from "./libheif";
import { convert as convertLibjxl, properties as propertiesLibjxl } from "./libjxl";
import { convert as convertLibreOffice, properties as propertiesLibreOffice } from "./libreoffice";
import { convert as convertMsgconvert, properties as propertiesMsgconvert } from "./msgconvert";
import { convert as convertPandoc, properties as propertiesPandoc } from "./pandoc";
import { convert as convertPdftops, properties as propertiesPdftops } from "./pdftops";
import { convert as convertPotrace, properties as propertiesPotrace } from "./potrace";
import { convert as convertresvg, properties as propertiesresvg } from "./resvg";
import { convert as convertImage, properties as propertiesImage } from "./vips";
import { convert as convertVtracer, properties as propertiesVtracer } from "./vtracer";
import { convert as convertVcf, properties as propertiesVcf } from "./vcf";
import { convert as convertxelatex, properties as propertiesxelatex } from "./xelatex";
import { convert as convertMarkitdown, properties as propertiesMarkitdown } from "./markitdown";

// This should probably be reconstructed so that the functions are not imported instead the functions hook into this to make the converters more modular

const properties: Record<
  string,
  {
    properties: {
      from: Record<string, string[]>;
      to: Record<string, string[]>;
      options?: Record<
        string,
        Record<
          string,
          {
            description: string;
            type: string;
            default: number;
          }
        >
      >;
    };
    converter: (
      filePath: string,
      fileType: string,
      convertTo: string,
      targetPath: string,

      options?: unknown,
    ) => unknown;
  }
> = {
  // Prioritize Inkscape for EMF files as it handles them better than ImageMagick
  inkscape: {
    properties: propertiesInkscape,
    converter: convertInkscape,
  },
  libjxl: {
    properties: propertiesLibjxl,
    converter: convertLibjxl,
  },
  resvg: {
    properties: propertiesresvg,
    converter: convertresvg,
  },
  vips: {
    properties: propertiesImage,
    converter: convertImage,
  },
  libheif: {
    properties: propertiesLibheif,
    converter: convertLibheif,
  },
  xelatex: {
    properties: propertiesxelatex,
    converter: convertxelatex,
  },
  calibre: {
    properties: propertiesCalibre,
    converter: convertCalibre,
  },
  dasel: {
    properties: propertiesDasel,
    converter: convertDasel,
  },
  libreoffice: {
    properties: propertiesLibreOffice,
    converter: convertLibreOffice,
  },
  pandoc: {
    properties: propertiesPandoc,
    converter: convertPandoc,
  },
  msgconvert: {
    properties: propertiesMsgconvert,
    converter: convertMsgconvert,
  },
  dvisvgm: {
    properties: propertiesDvisvgm,
    converter: convertDvisvgm,
  },
  imagemagick: {
    properties: propertiesImagemagick,
    converter: convertImagemagick,
  },
  graphicsmagick: {
    properties: propertiesGraphicsmagick,
    converter: convertGraphicsmagick,
  },
  assimp: {
    properties: propertiesassimp,
    converter: convertassimp,
  },
  ffmpeg: {
    properties: propertiesFFmpeg,
    converter: convertFFmpeg,
  },
  potrace: {
    properties: propertiesPotrace,
    converter: convertPotrace,
  },
  vtracer: {
    properties: propertiesVtracer,
    converter: convertVtracer,
  },
  vcf: {
    properties: propertiesVcf,
    converter: convertVcf,
  },
  markitDown: {
    properties: propertiesMarkitdown,
    converter: convertMarkitdown,
  },
  pdftops: {
    properties: propertiesPdftops,
    converter: convertPdftops,
  },
};

export async function handleConvert(
  fileNames: string[],
  userUploadsDir: string,
  userOutputDir: string,
  convertTo: string,
  converterName: string,
  jobId: Cookie<string | undefined>,
  priority = 0,
  options: { density?: number } = {},
) {
  const query = db.query(
    "INSERT INTO file_names (job_id, file_name, output_file_name, status) VALUES (?1, ?2, ?3, ?4)",
  );

  const jobKey = jobId.value ?? "";
  trackQueued(
    jobKey,
    fileNames.map((file) => ({ file, sizeBytes: Bun.file(`${userUploadsDir}${file}`).size })),
  );

  // Every file goes through the shared queue, so paid tiers (higher priority)
  // jump ahead of free users when the server is busy.
  await Promise.all(
    fileNames.map((fileName) =>
      conversionQueue.run(async () => {
        trackStarted(jobKey, fileName);
        const filePath = `${userUploadsDir}${fileName}`;
        const fileTypeOrig = fileName.includes(".") ? (fileName.split(".").pop() ?? "") : "";
        const fileType = normalizeFiletype(fileTypeOrig);
        const newFileExt = normalizeOutputFiletype(convertTo);
        let newFileName: string;
        if (fileTypeOrig === "") {
          newFileName = `${fileName}.${newFileExt}`;
        } else {
          newFileName = fileName.replace(
            new RegExp(`${fileTypeOrig}(?!.*${fileTypeOrig})`),
            newFileExt,
          );
        }
        const targetPath = `${userOutputDir}${newFileName}`;
        const r = await mainConverter(
          filePath,
          fileType,
          convertTo,
          targetPath,
          { ...options, onProgress: (percent: number) => trackPercent(jobKey, fileName, percent) },
          converterName,
        );
        const outputs = r === "Done" ? await findOutputFiles(userOutputDir, newFileName) : [];
        // A converter that exits cleanly but writes nothing would otherwise show "Done"
        // next to a download link that 404s
        const status = r === "Done" && outputs.length === 0 ? "Failed, check logs" : r;
        if (jobId.value) {
          for (const output of outputs.length > 0 ? outputs : [newFileName]) {
            query.run(jobId.value, fileName, output, status);
          }
        }
        trackFinished(jobKey, fileName, status.startsWith("Done"));
        return status;
      }, priority),
    ),
  ).finally(() => forgetJob(jobKey));
}

/**
 * Returns the files a conversion produced. Multi-page inputs (e.g. a PDF to JPG
 * with ImageMagick) are written as name-0.jpg, name-1.jpg, ... instead of name.jpg,
 * so each page gets its own result row.
 */
async function findOutputFiles(outputDir: string, fileName: string): Promise<string[]> {
  if (await Bun.file(`${outputDir}${fileName}`).exists()) {
    return [fileName];
  }

  const dot = fileName.lastIndexOf(".");
  const stem = dot === -1 ? fileName : fileName.slice(0, dot);
  const extension = dot === -1 ? "" : fileName.slice(dot);
  const pageNumber = (name: string) => {
    if (!name.startsWith(`${stem}-`) || !name.endsWith(extension)) {
      return null;
    }
    const digits = name.slice(stem.length + 1, name.length - extension.length);
    return /^\d+$/.test(digits) ? Number(digits) : null;
  };

  const pages = (await readdir(outputDir).catch(() => [] as string[]))
    .map((name) => ({ name, page: pageNumber(name) }))
    .filter((entry): entry is { name: string; page: number } => entry.page !== null)
    .sort((a, b) => a.page - b.page);

  // Page numbering starts at 0; without it these are unrelated files
  return pages[0]?.page === 0 ? pages.map((entry) => entry.name) : [];
}

async function mainConverter(
  inputFilePath: string,
  fileTypeOriginal: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  converterName?: string,
) {
  const fileType = normalizeFiletype(fileTypeOriginal);

  let converterFunc: (typeof properties)["libjxl"]["converter"] | undefined;

  if (converterName) {
    converterFunc = properties[converterName]?.converter;
  } else {
    // Iterate over each converter in properties
    for (converterName in properties) {
      const converterObj = properties[converterName];

      if (!converterObj) {
        break;
      }

      for (const key in converterObj.properties.from) {
        if (
          converterObj?.properties?.from[key]?.includes(fileType) &&
          converterObj?.properties?.to[key]?.includes(convertTo)
        ) {
          converterFunc = converterObj.converter;
          break;
        }
      }
    }
  }

  if (!converterFunc) {
    console.log(`No available converter supports converting from ${fileType} to ${convertTo}.`);
    return "File type not supported";
  }

  try {
    const result = await converterFunc(inputFilePath, fileType, convertTo, targetPath, options);

    console.log(
      `Converted ${inputFilePath} from ${fileType} to ${convertTo} successfully using ${converterName}.`,
      result,
    );

    if (typeof result === "string") {
      return result;
    }

    return "Done";
  } catch (error) {
    console.error(
      `Failed to convert ${inputFilePath} from ${fileType} to ${convertTo} using ${converterName}.`,
      error,
    );
    return "Failed, check logs";
  }
}

const possibleTargets: Record<string, Record<string, string[]>> = {};

for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;
  if (!converterProperties) continue;

  for (const key in converterProperties.from) {
    const fromList = converterProperties.from[key];
    const toList = converterProperties.to[key];

    if (!fromList || !toList) continue;

    for (const ext of fromList) {
      if (!possibleTargets[ext]) possibleTargets[ext] = {};

      possibleTargets[ext][converterName] = toList;
    }
  }
}

export const getPossibleTargets = (from: string): Record<string, string[]> => {
  const fromClean = normalizeFiletype(from);

  return possibleTargets[fromClean] || {};
};

const possibleInputs: string[] = [];
for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;

  if (!converterProperties) {
    continue;
  }

  for (const key in converterProperties.from) {
    for (const extension of converterProperties.from[key] ?? []) {
      if (!possibleInputs.includes(extension)) {
        possibleInputs.push(extension);
      }
    }
  }
}
possibleInputs.sort();

const allTargets: Record<string, string[]> = {};

for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;

  if (!converterProperties) {
    continue;
  }

  for (const key in converterProperties.to) {
    if (allTargets[converterName]) {
      allTargets[converterName].push(...(converterProperties.to[key] || []));
    } else {
      allTargets[converterName] = converterProperties.to[key] || [];
    }
  }
}

export const getAllTargets = () => {
  return allTargets;
};

const allInputs: Record<string, string[]> = {};
for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;

  if (!converterProperties) {
    continue;
  }

  for (const key in converterProperties.from) {
    if (allInputs[converterName]) {
      allInputs[converterName].push(...(converterProperties.from[key] || []));
    } else {
      allInputs[converterName] = converterProperties.from[key] || [];
    }
  }
}

export const getAllInputs = (converter: string) => {
  return allInputs[converter] || [];
};

/**
 * @internal For testing only. Do not use in production.
 * Tests need direct access to cover all branches of converter discovery and chunking logic.
 */
export { findOutputFiles, mainConverter };
