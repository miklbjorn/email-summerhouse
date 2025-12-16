#!/usr/bin/env python3
"""
Manual test script for the Cloudflare Email Worker

This script provides a utility function to send test emails to the locally running worker
at http://localhost:8787/cdn-cgi/handler/email
"""

import base64
import email.utils
import mimetypes
import os
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

import requests

EMAIL_WORKER_URL = 'http://localhost:8787/cdn-cgi/handler/email'


def create_and_send_email(
    from_email: str,
    to_email: str,
    subject: str = "Testing Email Workers Local Dev",
    body: str = "Hi there",
    attachments: Optional[List[str]] = None
) -> requests.Response:
    """
    Create and send an email to the Cloudflare Email Worker.
    
    Args:
        from_email: Sender email address
        to_email: Recipient email address
        subject: Email subject (default: "Testing Email Workers Local Dev")
        body: Email body text (default: "Hi there")
        attachments: Optional list of file paths to attach (jpg or pdf files)
    
    Returns:
        requests.Response: The HTTP response from the worker
    
    Example:
        # Simple email
        response = create_and_send_email(
            from_email="sender@example.com",
            to_email="recipient@example.com"
        )
        
        # Email with attachments
        response = create_and_send_email(
            from_email="sender@example.com",
            to_email="recipient@example.com",
            subject="Invoice attached",
            body="Please find the invoice attached.",
            attachments=["invoice.pdf", "photo.jpg"]
        )
    """
    # Create multipart message
    if attachments:
        msg = MIMEMultipart()
    else:
        msg = MIMEMultipart('alternative')
    
    # Set headers
    msg['From'] = f'"John" <{from_email}>'
    msg['To'] = to_email
    msg['Reply-To'] = from_email
    msg['Subject'] = subject
    msg['Date'] = email.utils.formatdate()
    msg['Message-ID'] = email.utils.make_msgid()
    msg['X-Mailer'] = 'Python Test Script'
    
    # Add body
    msg.attach(MIMEText(body, 'plain'))
    
    # Add attachments if provided
    if attachments:
        for file_path in attachments:
            if not os.path.isfile(file_path):
                raise FileNotFoundError(f"Attachment file not found: {file_path}")
            
            # Determine content type
            content_type, _ = mimetypes.guess_type(file_path)
            if content_type is None:
                # Default based on extension
                if file_path.lower().endswith('.jpg') or file_path.lower().endswith('.jpeg'):
                    content_type = 'image/jpeg'
                elif file_path.lower().endswith('.pdf'):
                    content_type = 'application/pdf'
                else:
                    content_type = 'application/octet-stream'
            
            # Read file and attach
            with open(file_path, 'rb') as f:
                part = MIMEApplication(f.read(), _subtype=content_type.split('/')[1])
            
            part.add_header(
                'Content-Disposition',
                f'attachment; filename="{os.path.basename(file_path)}"'
            )
            msg.attach(part)
    
    # Convert to raw email string
    raw_email = msg.as_string()
    
    # Add Received header at the beginning (as in original curl example)
    received_header = f"""Received: from smtp.example.com (127.0.0.1)
        by cloudflare-email.com (unknown) id 4fwwffRXOpyR
        for <{to_email}>; {email.utils.formatdate()}
"""
    raw_email = received_header + raw_email
    
    # Send to worker
    params = {
        'from': from_email,
        'to': to_email
    }
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    response = requests.post(
        EMAIL_WORKER_URL,
        params=params,
        headers=headers,
        data=raw_email
    )
    
    return response


# Example usage
if __name__ == '__main__':
    # Simple email without attachments
    print("Sending simple email...")
    response = create_and_send_email(
        from_email="sender@example.com",
        to_email="recipient@example.com"
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    print()
    
    # Email with attachments (uncomment and provide actual file paths)
    # print("Sending email with attachments...")
    # response = create_and_send_email(
    #     from_email="sender@example.com",
    #     to_email="recipient@example.com",
    #     subject="Invoice attached",
    #     body="Please find the invoice and photo attached.",
    #     attachments=["path/to/invoice.pdf", "path/to/photo.jpg"]
    # )
    # print(f"Status: {response.status_code}")
    # print(f"Response: {response.text}")
