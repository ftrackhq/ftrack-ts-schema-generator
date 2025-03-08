import { Session } from "@ftrack/api";
import type {
  ObjectType,
  Type,
  Priority,
  ProjectSchema,
  Status,
} from "./emit.ts";
import type { CustomAttributeConfiguration } from "./emitCustomAttributes.ts";

export interface Schema {
  ObjectType: ObjectType;
  CustomAttributeConfiguration: CustomAttributeConfiguration;
  Type: Type;
  Priority: Priority;
  ProjectSchema: ProjectSchema;
  Status: Status;
}

export const session = new Session<Schema>(
  process.env.FTRACK_SERVER ?? "",
  process.env.FTRACK_API_USER ?? "",
  process.env.FTRACK_API_KEY ?? "",
  {
    autoConnectEventHub: false,
  },
);
