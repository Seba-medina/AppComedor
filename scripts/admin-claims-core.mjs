export const ADMIN_TARGET_EMAILS=['sebastianezequielmedina@gmail.com','marchesemarialaura@gmail.com'];
export async function manageAdminClaims(auth,db,mode='check'){
 if(!['check','grant'].includes(mode))throw new Error('Unsupported action');
 const users=await Promise.all(ADMIN_TARGET_EMAILS.map(email=>auth.getUserByEmail(email)));
 for(let i=0;i<users.length;i++){const user=users[i];if(user.email!==ADMIN_TARGET_EMAILS[i]||!user.emailVerified||user.disabled||!user.uid||user.uid.includes('/')||!user.providerData?.some(p=>p.providerId==='google.com'))throw new Error('Expected verified Google account not found');}
 if(new Set(users.map(u=>u.uid)).size!==users.length)throw new Error('Duplicate target UID');
 if(mode==='grant'){
  // Protect both accounts before exposing claim-based deletion controls.
  const batch=db.batch();for(const user of users)batch.set(db.collection('adminRoles').doc(user.uid),{admin:true},{merge:true});await batch.commit();
  for(const user of users){const fresh=await auth.getUser(user.uid);if(fresh.disabled||fresh.email!==user.email||!fresh.emailVerified)throw new Error('Target account changed during operation');await auth.setCustomUserClaims(user.uid,{...(fresh.customClaims||{}),admin:true});}
 }
 const results=[];
 for(const target of users){const user=await auth.getUser(target.uid),role=await db.collection('adminRoles').doc(target.uid).get();results.push({uid:user.uid,email:user.email,claim:user.customClaims?.admin===true,protected:role.exists&&role.data()?.admin===true});}
 return results;
}
