import AbstractCommand from '../abstract-command';
import { CallableContext } from 'firebase-functions/lib/providers/https';
import { ERROR_TASK_NOT_FOUND, IResult } from '../utils/types';
import { NeedAuthentication, ValidateRequired } from '../utils/decorators';
import { CloudTasksClient } from '@google-cloud/tasks';
import { google } from '@google-cloud/tasks/build/protos/protos';
import HttpMethod = google.cloud.tasks.v2.HttpMethod;

const PROJECT_ID = 'remap-b2d08';
const LOCATION = 'asia-northeast1';
const QUEUE = 'build-task-queue';
const BUILD_SERVER_URL = 'https://remap-build-server-l3esb446ua-an.a.run.app';

export class CreateFirmwareBuildingTaskCommand extends AbstractCommand<IResult> {
  @NeedAuthentication()
  @ValidateRequired(['keyboardDefinitionId'])
  async execute(data: any, context: CallableContext): Promise<IResult> {
    const taskId = data.taskId;
    const uid = context.auth!.uid;

    const doc = await this.db
      .collection('build')
      .doc('v1')
      .collection('tasks')
      .doc(taskId)
      .get();
    if (!doc.exists) {
      return {
        success: false,
        errorCode: ERROR_TASK_NOT_FOUND,
        errorMessage: `The task [${taskId}] is not found (1)`,
      };
    }
    const taskUid = doc.data()!.uid;
    if (uid !== taskUid) {
      return {
        success: false,
        errorCode: ERROR_TASK_NOT_FOUND,
        errorMessage: `The task [${taskId}] is not found (2)`,
      };
    }

    const client = new CloudTasksClient();
    const parent = client.queuePath(PROJECT_ID, LOCATION, QUEUE);

    const task = {
      httpRequest: {
        headers: {
          'Content-Type': 'text/plain',
        },
        httpMethod: HttpMethod.GET,
        url: `${BUILD_SERVER_URL}/build?uid=${uid}&taskId=${taskId}`,
      },
    };
    const request = {
      parent,
      task,
    };
    const [response] = await client.createTask(request);
    console.log(
      `Creating the firmware building task was successfully. The response.name is ${response.name}`
    );

    return { success: true };
  }
}
