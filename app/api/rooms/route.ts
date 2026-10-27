import { env } from 'cloudflare:workers';
import { handleRoomRequest } from '../../../server/room-service.mjs';
export function POST(request: Request) { return handleRoomRequest(request,env); }
