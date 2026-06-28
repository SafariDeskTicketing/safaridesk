STATUS_CHOICES = [
        ('A', 'ACTIVE'),
        ('I', 'INACTIVE'),
        ('S', 'Suspended'),
        ('D', 'DEACTIVATED'),
        ('L', 'LOCKED'),
        ('B', 'BLOCKED'),
    ]

TICKET_ACTIVITY_CHOICES = [
        ('created', 'Ticket Created'),
        ('updated', 'Ticket Updated'),
        ('commented', 'Comment Added'),
        ('assigned', 'Ticket Assigned'),
        ('status_changed', 'Status Changed'),
        ('priority_changed', 'Priority Changed'),
        ('attachment_added', 'Attachment Added'),
        ('resolved', 'Ticket Resolved'),
        ('closed', 'Ticket Closed'),
        ('task_linked', 'Task Linked'),
        ('label_added', 'Label Added'),
        ('label_removed', 'Label Removed'),
        ('call_logged', 'Call Logged'),
    ]

TASK_ACTIVITY_CHOICES = [
        ('created', 'Task Created'),
        ('updated', 'Task Updated'),
        ('commented', 'Comment Added'),
        ('assigned', 'Task Assigned'),
        ('reassigned', 'Task Reassigned'),
        ('status_changed', 'Status Changed'),
        ('priority_changed', 'Priority Changed'),
        ('attachment_added', 'Attachment Added'),
        ('attached_to_ticket', 'Attached to Ticket'),
        ('completed', 'Task Completed'),
    ]

PRIORITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]


PRIORITY_DURATION = [
        ('p1', '1'),
        ('p2', '2'),
        ('p3', '4'),
        ('p4', '8'),
        ('p5', '12'),
    ]
