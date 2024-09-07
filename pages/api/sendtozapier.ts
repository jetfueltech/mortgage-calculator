import type { NextApiRequest, NextApiResponse } from 'next';

type Data = {
  success: boolean;
  message: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method === 'POST') {
    const webhookUrl = 'https://hooks.zapier.com/hooks/catch/12401881/2tnx5e1/';

    try {

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      if (response.ok) {
        return res.status(200).json({ success: true, message: 'Data sent to Zapier successfully' });
      } else {
        return res.status(response.status).json({ success: false, message: 'Failed to send data to Zapier' });
      }
    } catch (error) {
      console.error('Error sending data to Zapier:', error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

  