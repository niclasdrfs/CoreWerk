import { supabase } from "@/integrations/supabase/client";

interface SendPushNotificationParams {
  userId: string;
  title: string;
  body: string;
  url?: string;
}

/**
 * Send a push notification to a user via the edge function
 */
export const sendPushNotification = async ({
  userId,
  title,
  body,
  url,
}: SendPushNotificationParams): Promise<{ success: boolean; sent?: number; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        user_id: userId,
        title,
        body,
        url,
      },
    });

    if (error) {
      console.error("Error sending push notification:", error);
      return { success: false, error: error.message };
    }

    console.log("Push notification result:", data);
    return { success: true, sent: data?.sent || 0 };
  } catch (error: any) {
    console.error("Failed to send push notification:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification when employee is assigned to a construction site
 */
export const notifyEmployeeAssignment = async (
  employeeId: string,
  constructionSiteName: string,
  assignmentDate: string
): Promise<void> => {
  const formattedDate = new Date(assignmentDate).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  await sendPushNotification({
    userId: employeeId,
    title: "Neue Baustellen-Zuteilung",
    body: `Sie wurden "${constructionSiteName}" am ${formattedDate} zugeteilt.`,
    url: "/employee",
  });
};
