import {
  ERROR_ORGANIZATION_NOT_FOUND,
  IOrganization,
  IResult,
} from '../utils/types';
import AbstractCommand from '../abstract-command';
import {
  NeedAuthentication,
  NeedOrganizationMember,
  ValidateRequired,
} from '../utils/decorators';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import DocumentSnapshot = admin.firestore.DocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;

type IOrganizationMember = {
  uid: string;
  email: string;
  displayName: string;
  me: boolean;
};

interface IFetchOrganizationMemberDataCommandResult extends IResult {
  members?: IOrganizationMember[];
}

export class FetchOrganizationMembersCommand extends AbstractCommand<IFetchOrganizationMemberDataCommandResult> {
  @NeedAuthentication()
  @ValidateRequired(['organizationId'])
  @NeedOrganizationMember()
  async execute(
    data: any,
    context: functions.https.CallableContext
  ): Promise<IFetchOrganizationMemberDataCommandResult> {
    const organizationDocumentSnapshot = await this.db
      .collection('organizations')
      .doc('v1')
      .collection('profiles')
      .doc(data.organizationId)
      .get();
    if (!organizationDocumentSnapshot.exists) {
      return {
        success: false,
        errorCode: ERROR_ORGANIZATION_NOT_FOUND,
        errorMessage: `Organization not found: ${data.organizationId}`,
      };
    }
    const organization = FetchOrganizationMembersCommand.createOrganization(
      organizationDocumentSnapshot
    );
    const uid = context.auth!.uid;
    const members: IOrganizationMember[] = [];
    for (const memberUid of organization.members) {
      const userRecord = await admin.auth().getUser(memberUid);
      members.push({
        uid: memberUid,
        email: userRecord.email!,
        displayName: userRecord.displayName!,
        me: uid === memberUid,
      });
    }
    return {
      success: true,
      members,
    };
  }

  private static createOrganization(
    documentSnapshot: DocumentSnapshot<DocumentData>
  ): IOrganization {
    return {
      id: documentSnapshot.id,
      name: documentSnapshot.data()!.name,
      description: documentSnapshot.data()!.description,
      iconImageUrl: documentSnapshot.data()!.icon_image_url,
      websiteUrl: documentSnapshot.data()!.website_url,
      contactEmailAddress: documentSnapshot.data()!.contact_email_address,
      contactPersonName: documentSnapshot.data()!.contact_person_name,
      contactTel: documentSnapshot.data()!.contact_tel,
      contactAddress: documentSnapshot.data()!.contact_address,
      members: documentSnapshot.data()!.members,
      createdAt: documentSnapshot.data()!.created_at,
      updatedAt: documentSnapshot.data()!.updated_at,
    };
  }
}
