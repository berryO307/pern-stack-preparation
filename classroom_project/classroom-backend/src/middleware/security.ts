import type {Response, Request, NextFunction} from "express";
import aj from '../config/arcjet.js';
import {ArcjetNodeRequest, ArcjetRequest, slidingWindow} from "@arcjet/node";

const securityMiddleware = async (req: Request, res:Response, next: NextFunction) => {
   try {
       const role: RateLimitRole = req.user?.role ?? 'guest';

       let limit: number;
       let message: string;

       switch(role) {
           case 'admin':
               limit = 120;
               message = 'Admin request limit exceeded (120 per minute).Slow Down.';
               break;
           case 'teacher':
           case 'student':
               limit = 60;
               message = 'User request limit exceeded (60 per minute).Please Wait.';
               break;
           default:
               limit = 30;
               message = 'Guest request limit exceeded (30 per minute).Please Wait.'
               break;
       }

       const client = aj.withRule(
           slidingWindow({
               mode: 'LIVE',
               interval: '1m',
               max: limit,
           })
       )

       const arcjetRequest: ArcjetNodeRequest = {
           headers: req.headers,
           method: req.method,
           url: req.originalUrl ?? req.url,
           socket: { remoteAddress: req.socket.remoteAddress ?? req.ip ?? '0.0.0.0' },
       }

       const decision = await client.protect(arcjetRequest);

       if(decision.isDenied() && decision.reason.isBot()) {
           return res.status(403).json({error: 'Forbidden.', message: 'Automated Requests are not allowed.'});
       }

       if(decision.isDenied() && decision.reason.isShield()) {
           return res.status(403).json({error: 'Forbidden.', message: 'Request blocked by security policy.'});
       }

       if(decision.isDenied() && decision.reason.isRateLimit()) {
           return res.status(403).json({error: 'Too many Requests.', message});
       }

       next();

   } catch (e) {
       console.error("Arcjet Middleware Error", e);
       res.status(500).json({error: 'Internal Server Error', message: 'Something went wrong with security middleware'});
   }
}
export default securityMiddleware;