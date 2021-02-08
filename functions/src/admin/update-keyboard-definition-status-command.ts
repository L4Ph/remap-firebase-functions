import AbstractCommand from '../abstract-command';
import { CallableContext } from 'firebase-functions/lib/providers/https';
import { ERROR_KEYBOARD_DEFINITION_NOT_FOUND, IResult } from '../types';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
  ValidateIncludes,
  ValidateRequired,
} from './decorators';
import * as axios from 'axios';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as jwt from 'jsonwebtoken';

export class UpdateKeyboardDefinitionStatusCommand extends AbstractCommand {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  @ValidateRequired(['id', 'status', 'rejectReason'])
  @ValidateIncludes({
    status: ['draft', 'in_review', 'rejected', 'approved'],
  })
  async execute(data: any, context: CallableContext): Promise<IResult> {
    const documentSnapshot = await this.db
      .collection('keyboards')
      .doc('v2')
      .collection('definitions')
      .doc(data.id)
      .get();
    if (!documentSnapshot.exists) {
      return {
        success: false,
        errorCode: ERROR_KEYBOARD_DEFINITION_NOT_FOUND,
        errorMessage: `Keyboard Definition not found: ${data.id}`,
      };
    }
    await documentSnapshot.ref.update({
      status: data.status,
      reject_reason: data.rejectReason,
      updated_at: new Date(),
    });
    const userRecord = await admin
      .auth()
      .getUser(documentSnapshot.data()!.author_uid);
    const providerData = userRecord.providerData[0];
    const payload = {
      email: providerData.email,
      displayName: providerData.displayName,
      keyboard: documentSnapshot.data()!.name,
      status: data.status,
      definitionId: documentSnapshot.id,
    };
    const jwtSecret = functions.config().jwt.secret;
    const jwtOptions: jwt.SignOptions = {
      algorithm: 'HS256',
      expiresIn: '3m',
    };
    const token = jwt.sign(payload, jwtSecret, jwtOptions);
    console.log(token);
    await axios.default.post<void>(functions.config().notification.url, {
      token,
      payload,
    });
    return {
      success: true,
    };
  }
}
