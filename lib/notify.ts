/**
 * Sends a notification to a user by calling the /api/notify endpoint.
 * 
 * @param userId - The ID of the user to notify
 * @param message - The notification message
 * @param documentId - Optional document ID to associate with the notification
 * @returns Promise that resolves when notification is sent
 * @throws Error if the notification fails to send
 */
export async function sendNotification(
  userId: string,
  message: string,
  documentId?: string
): Promise<void> {
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        message,
        document_id: documentId || null,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `Failed to send notification: ${response.status}`)
    }

    // Successfully sent notification
    return
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Notification failed: ${error.message}`)
    }
    throw new Error('Notification failed: Unknown error')
  }
}
