import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region });

// Shared DynamoDB Document client. marshallOptions strip undefined values so
// callers never have to pre-clean items before writing/reading.
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

// Table-name constants sourced from Lambda environment variables, with the
// canonical resource names as fallbacks.
export const LEADS_TABLE = process.env.LEADS_TABLE || 'carcompra-leads';
export const VENDEDORES_TABLE = process.env.VENDEDORES_TABLE || 'carcompra-vendedores';
export const CONFIG_TABLE = process.env.CONFIG_TABLE || 'carcompra-config';
