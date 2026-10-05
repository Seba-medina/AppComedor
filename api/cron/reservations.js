import {emailJob} from '../../server/email-job.mjs';
export default (req,res)=>emailJob(req,res,'report');
